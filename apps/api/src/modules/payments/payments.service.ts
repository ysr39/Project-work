import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Payment } from './entities/payment.entity';
import { StripeService } from './stripe.service';
import { WalletService } from './wallet.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { TripPassenger } from '../trips/entities/trip-passenger.entity';
import { User } from '../users/entities/user.entity';
import { PaymentStatus, PaymentMethod } from '../../common/constants/trip-status.enum';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)       private readonly paymentRepo:   Repository<Payment>,
    @InjectRepository(TripPassenger) private readonly passengerRepo: Repository<TripPassenger>,
    @InjectRepository(User)          private readonly userRepo:      Repository<User>,
    private readonly stripeService: StripeService,
    private readonly walletService: WalletService,
  ) {}

  /* ─── Create PaymentIntent (authorize-only, capture on completion) ────── */

  async createPaymentIntent(riderId: string, dto: CreatePaymentIntentDto) {
    const passenger = await this.passengerRepo.findOne({
      where: { id: dto.tripPassengerId, riderId },
      relations: ['trip'],
    });
    if (!passenger) throw new NotFoundException('Trip passenger record not found');

    const existing = await this.paymentRepo.findOne({
      where: { tripPassengerId: dto.tripPassengerId },
    });
    if (existing?.status === PaymentStatus.CAPTURED) {
      throw new BadRequestException('Payment already captured for this ride');
    }

    const amountPaise    = Math.round(Number(passenger.finalFare) * 100);
    const idempotencyKey = `intent-${passenger.id}-${amountPaise}`;

    const user = await this.userRepo.findOne({ where: { id: riderId } });
    const customer = await this.stripeService.createOrRetrieveCustomer(
      user!.phone,
      user!.fullName ?? undefined,
    );

    const intent = await this.stripeService.createRidePaymentIntent({
      amountPaise,
      riderId,
      tripId:          passenger.tripId,
      tripPassengerId: passenger.id,
      customerId:      customer.id,
      idempotencyKey,
    });

    const payment = this.paymentRepo.create({
      tripId:                passenger.tripId,
      tripPassengerId:       passenger.id,
      riderId,
      amount:                passenger.finalFare,
      currency:              this.stripeService.currency,
      paymentMethod:         dto.paymentMethod ?? PaymentMethod.CARD,
      stripePaymentIntentId: intent.id,
      status:                PaymentStatus.PENDING,
    });
    await this.paymentRepo.save(payment);

    return {
      clientSecret: intent.client_secret,
      paymentId:    payment.id,
      amount:       passenger.finalFare,
      currency:     this.stripeService.currency,
    };
  }

  /* ─── Capture after trip completes ───────────────────────────────────── */

  async captureOnTripComplete(tripId: string): Promise<void> {
    const payments = await this.paymentRepo.find({
      where: { tripId, status: PaymentStatus.PENDING },
    });

    for (const payment of payments) {
      if (!payment.stripePaymentIntentId) continue;
      try {
        const captured = await this.stripeService.captureRidePayment(payment.stripePaymentIntentId);
        await this.paymentRepo.update(payment.id, {
          status:         PaymentStatus.CAPTURED,
          stripeChargeId: captured.latest_charge as string,
          capturedAt:     new Date(),
        });
        this.logger.log(`Captured payment ${payment.id} for trip ${tripId}`);
      } catch (err: any) {
        this.logger.error(`Capture failed for payment ${payment.id}`, err);
        await this.paymentRepo.update(payment.id, {
          status:       PaymentStatus.FAILED,
          failedReason: err.message,
        });
      }
    }
  }

  async cancelAuthOnTripCancel(tripId: string): Promise<void> {
    const payments = await this.paymentRepo.find({
      where: { tripId, status: PaymentStatus.PENDING },
    });
    for (const payment of payments) {
      if (!payment.stripePaymentIntentId) continue;
      try {
        await this.stripeService.cancelPaymentIntent(payment.stripePaymentIntentId);
        await this.paymentRepo.update(payment.id, {
          status: 'CANCELLED' as any,
        });
      } catch (err: any) {
        this.logger.warn(`Could not cancel PaymentIntent ${payment.stripePaymentIntentId}`, err);
      }
    }
  }

  /* ─── Wallet top-up ───────────────────────────────────────────────────── */

  async initiateWalletTopup(userId: string, amountRupees: number) {
    return this.walletService.initiateTopup(userId, amountRupees);
  }

  /* ─── Stripe Webhook dispatcher ───────────────────────────────────────── */

  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: any;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    this.logger.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':         await this._onPiSucceeded(event.data.object);    break;
      case 'payment_intent.payment_failed':    await this._onPiFailed(event.data.object);       break;
      case 'payment_intent.canceled':          await this._onPiCancelled(event.data.object);    break;
      case 'charge.refund.updated':            await this._onRefundUpdated(event.data.object);  break;
      case 'account.updated':                  this._onConnectAccountUpdated(event.data.object); break;
      case 'transfer.failed':
        this.logger.warn(`Stripe transfer failed: ${event.data.object.id}`);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }

    return { received: true };
  }

  /* ─── Individual webhook handlers ────────────────────────────────────── */

  private async _onPiSucceeded(pi: any) {
    if (pi.metadata?.source === 'wallet_topup') {
      const walletId = pi.metadata?.walletId as string;
      if (walletId) {
        await this.walletService.creditFromStripe({
          walletId,
          amountPaise:           pi.amount_received,
          stripePaymentIntentId: pi.id,
          chargeId:              pi.latest_charge,
        });
      }
      return;
    }

    // Ride payment captured (non-manual path or after our capture call)
    await this.paymentRepo.update(
      { stripePaymentIntentId: pi.id },
      {
        status:         PaymentStatus.CAPTURED,
        stripeChargeId: pi.latest_charge,
        capturedAt:     new Date(),
      },
    );
  }

  private async _onPiFailed(pi: any) {
    await this.paymentRepo.update(
      { stripePaymentIntentId: pi.id },
      {
        status:       PaymentStatus.FAILED,
        failedReason: pi.last_payment_error?.message ?? 'Unknown error',
      },
    );
  }

  private async _onPiCancelled(pi: any) {
    await this.paymentRepo.update(
      { stripePaymentIntentId: pi.id },
      { status: 'CANCELLED' as any },
    );
  }

  private async _onRefundUpdated(refund: any) {
    if (refund.status !== 'succeeded') return;

    const payment = await this.paymentRepo.findOne({
      where: { stripeChargeId: refund.charge },
    });
    if (!payment) return;

    await this.paymentRepo.update(payment.id, {
      status:       PaymentStatus.REFUNDED,
      refundAmount: refund.amount / 100,
      refundedAt:   new Date(),
    });

    // Post refund credit to wallet
    if (payment.riderId) {
      await this.walletService.creditRefund({
        userId:       payment.riderId,
        amountRupees: refund.amount / 100,
        tripId:       payment.tripId,
        paymentId:    payment.id,
      }).catch((err: any) => this.logger.warn('Wallet refund credit failed', err));
    }
  }

  private _onConnectAccountUpdated(account: any) {
    this.logger.log(
      `Connect account updated: ${account.id} — charges_enabled: ${account.charges_enabled}`,
    );
  }

  /* ─── Admin-initiated refund ──────────────────────────────────────────── */

  async refund(paymentId: string, opts?: { amountRupees?: number; reason?: string }) {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.CAPTURED) {
      throw new BadRequestException('Only captured payments can be refunded');
    }
    if (!payment.stripeChargeId) throw new BadRequestException('No charge ID — cannot refund');

    const amountPaise = opts?.amountRupees
      ? Math.round(opts.amountRupees * 100)
      : undefined;

    await this.stripeService.refundCharge({
      chargeId:       payment.stripeChargeId,
      amountPaise,
      idempotencyKey: `refund-${payment.id}-admin`,
    });

    const refundAmount = opts?.amountRupees ?? Number(payment.amount);
    await this.paymentRepo.update(paymentId, {
      status:       PaymentStatus.REFUNDED,
      refundAmount,
      refundReason: opts?.reason,
      refundedAt:   new Date(),
    });

    return { refundAmount, currency: payment.currency };
  }

  /* ─── Queries ─────────────────────────────────────────────────────────── */

  async getRiderHistory(riderId: string, dto: PaginationDto) {
    const [data, total] = await this.paymentRepo.findAndCount({
      where: { riderId },
      relations: ['trip'],
      skip:  dto.skip,
      take:  dto.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }

  async getAllPayments(dto: PaginationDto & { status?: PaymentStatus }) {
    const where = dto.status ? { status: dto.status } : {};
    const [data, total] = await this.paymentRepo.findAndCount({
      where,
      relations: ['rider', 'trip'],
      skip:  dto.skip,
      take:  dto.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }
}
