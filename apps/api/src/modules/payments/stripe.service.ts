import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface CreateRideIntentOptions {
  amountPaise:      number;
  riderId:          string;
  tripId:           string;
  tripPassengerId:  string;
  customerId?:      string;   // Stripe customer ID (if rider has saved card)
  idempotencyKey:   string;
}

export interface WalletTopupOptions {
  amountPaise:    number;
  userId:         string;
  walletId:       string;
  idempotencyKey: string;
  customerId?:    string;
}

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);
  readonly currency: string;

  constructor(private readonly config: ConfigService) {
    this.stripe = new Stripe(config.get<string>('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
      telemetry:  false,
    });
    this.currency = config.get<string>('STRIPE_CURRENCY', 'inr')!;
  }

  /* ─── Customer ────────────────────────────────────────────────────────── */

  async createOrRetrieveCustomer(phone: string, name?: string): Promise<Stripe.Customer> {
    const list = await this.stripe.customers.list({ phone, limit: 1 });
    if (list.data.length) return list.data[0];

    return this.stripe.customers.create({
      phone,
      name: name ?? undefined,
      metadata: { source: 'taxipool' },
    });
  }

  /* ─── Ride payment — manual capture (authorize now, capture on completion) */

  async createRidePaymentIntent(opts: CreateRideIntentOptions): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create(
      {
        amount:          opts.amountPaise,
        currency:        this.currency,
        capture_method:  'manual',          // auth-only; capture when trip completes
        confirm:         false,
        customer:        opts.customerId,
        automatic_payment_methods: { enabled: true },
        metadata: {
          tripId:         opts.tripId,
          tripPassengerId: opts.tripPassengerId,
          riderId:        opts.riderId,
          source:         'ride',
        },
        description: `TaxiPool ride – trip ${opts.tripId}`,
      },
      { idempotencyKey: opts.idempotencyKey },
    );
  }

  /** Capture the authorized amount when trip completes */
  async captureRidePayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.capture(paymentIntentId);
  }

  /** Capture with a reduced amount (fare recalculated after cancellation) */
  async capturePartial(paymentIntentId: string, reducedAmountPaise: number): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: reducedAmountPaise,
    });
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /* ─── Wallet top-up (immediate capture) ──────────────────────────────── */

  async createWalletTopupIntent(opts: WalletTopupOptions): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create(
      {
        amount:   opts.amountPaise,
        currency: this.currency,
        customer: opts.customerId,
        automatic_payment_methods: { enabled: true },
        metadata: {
          userId:   opts.userId,
          walletId: opts.walletId,
          source:   'wallet_topup',
        },
        description: 'TaxiPool wallet top-up',
      },
      { idempotencyKey: opts.idempotencyKey },
    );
  }

  /* ─── Refunds ─────────────────────────────────────────────────────────── */

  async refundCharge(opts: {
    chargeId:       string;
    amountPaise?:   number;   // omit for full refund
    reason?:        Stripe.RefundCreateParams.Reason;
    idempotencyKey: string;
  }): Promise<Stripe.Refund> {
    return this.stripe.refunds.create(
      {
        charge: opts.chargeId,
        ...(opts.amountPaise  ? { amount: opts.amountPaise } : {}),
        ...(opts.reason       ? { reason: opts.reason } : {}),
      },
      { idempotencyKey: opts.idempotencyKey },
    );
  }

  /* ─── Stripe Connect (driver onboarding) ─────────────────────────────── */

  async createConnectAccount(email: string, driverUserId: string): Promise<Stripe.Account> {
    return this.stripe.accounts.create({
      type:  'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers:     { requested: true },
      },
      settings: {
        payouts: { schedule: { interval: 'manual' } },   // we control payout timing
      },
      metadata: { driverUserId },
    });
  }

  async createAccountLink(accountId: string, baseUrl: string): Promise<Stripe.AccountLink> {
    return this.stripe.accountLinks.create({
      account:     accountId,
      refresh_url: `${baseUrl}/driver/onboarding/retry`,
      return_url:  `${baseUrl}/driver/onboarding/complete`,
      type:        'account_onboarding',
    });
  }

  async retrieveAccount(accountId: string): Promise<Stripe.Account> {
    return this.stripe.accounts.retrieve(accountId);
  }

  /* ─── Driver payout via Connect transfer ─────────────────────────────── */

  async transferToDriver(opts: {
    destinationAccountId: string;
    amountPaise:          number;
    description:          string;
    idempotencyKey:       string;
    sourceTransaction?:   string;   // charge ID to link transfer to a specific charge
  }): Promise<Stripe.Transfer> {
    return this.stripe.transfers.create(
      {
        amount:      opts.amountPaise,
        currency:    this.currency,
        destination: opts.destinationAccountId,
        description: opts.description,
        ...(opts.sourceTransaction ? { source_transaction: opts.sourceTransaction } : {}),
      },
      { idempotencyKey: opts.idempotencyKey },
    );
  }

  /** Reverse a transfer if payout should be clawed back */
  async reverseTransfer(transferId: string, amountPaise?: number): Promise<Stripe.TransferReversal> {
    return this.stripe.transfers.createReversal(transferId, {
      ...(amountPaise ? { amount: amountPaise } : {}),
    });
  }

  /* ─── Webhooks ────────────────────────────────────────────────────────── */

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.config.get<string>('STRIPE_WEBHOOK_SECRET')!,
    );
  }
}
