import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);
  readonly currency: string;

  constructor(private readonly config: ConfigService) {
    this.stripe = new Stripe(config.get<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2023-10-16',
    });
    this.currency = config.get<string>('STRIPE_CURRENCY', 'usd');
  }

  async createPaymentIntent(amountCents: number, metadata: Record<string, string>) {
    return this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: this.currency,
      metadata,
      automatic_payment_methods: { enabled: true },
    });
  }

  async capturePaymentIntent(paymentIntentId: string) {
    return this.stripe.paymentIntents.capture(paymentIntentId);
  }

  async refundPayment(chargeId: string, amountCents?: number) {
    return this.stripe.refunds.create({
      charge: chargeId,
      ...(amountCents && { amount: amountCents }),
    });
  }

  async createConnectAccount(email: string) {
    return this.stripe.accounts.create({
      type: 'express',
      email,
      capabilities: { transfers: { requested: true } },
    });
  }

  async transferToDriver(driverAccountId: string, amountCents: number, description: string) {
    return this.stripe.transfers.create({
      amount: amountCents,
      currency: this.currency,
      destination: driverAccountId,
      description,
    });
  }

  constructWebhookEvent(payload: Buffer, signature: string) {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.config.get<string>('STRIPE_WEBHOOK_SECRET'),
    );
  }
}
