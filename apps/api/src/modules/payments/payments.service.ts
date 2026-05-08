import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Payment } from './entities/payment.entity';
import { StripeService } from './stripe.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { TripPassenger } from '../trips/entities/trip-passenger.entity';
import { PaymentStatus } from '../../common/constants/trip-status.enum';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(TripPassenger) private readonly passengerRepo: Repository<TripPassenger>,
    private readonly stripeService: StripeService,
  ) {}

  async createPaymentIntent(riderId: string, dto: CreatePaymentIntentDto) {
    const passenger = await this.passengerRepo.findOne({
      where: { id: dto.tripPassengerId, riderId },
      relations: ['trip'],
    });
    if (!passenger) throw new NotFoundException('Trip passenger record not found');

    const existingPayment = await this.paymentRepo.findOne({
      where: { tripPassengerId: dto.tripPassengerId },
    });
    if (existingPayment?.status === PaymentStatus.CAPTURED) {
      throw new BadRequestException('Payment already captured for this ride');
    }

    const amountCents = Math.round(Number(passenger.finalFare) * 100);
    const intent = await this.stripeService.createPaymentIntent(amountCents, {
      tripId: passenger.tripId,
      tripPassengerId: passenger.id,
      riderId,
    });

    const payment = this.paymentRepo.create({
      tripId: passenger.tripId,
      tripPassengerId: passenger.id,
      riderId,
      amount: passenger.finalFare,
      currency: this.stripeService.currency,
      paymentMethod: dto.paymentMethod,
      stripePaymentIntentId: intent.id,
      status: PaymentStatus.PENDING,
    });
    await this.paymentRepo.save(payment);

    return { clientSecret: intent.client_secret, paymentId: payment.id };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: any;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        await this.paymentRepo.update(
          { stripePaymentIntentId: pi.id },
          {
            status: PaymentStatus.CAPTURED,
            stripeChargeId: pi.latest_charge,
            capturedAt: new Date(),
          },
        );
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        await this.paymentRepo.update(
          { stripePaymentIntentId: pi.id },
          {
            status: PaymentStatus.FAILED,
            failedReason: pi.last_payment_error?.message,
          },
        );
        break;
      }
    }
    return { received: true };
  }

  async refund(paymentId: string, reason?: string) {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (!payment.stripeChargeId) throw new BadRequestException('No charge to refund');

    await this.stripeService.refundPayment(payment.stripeChargeId);
    await this.paymentRepo.update(paymentId, {
      status: PaymentStatus.REFUNDED,
      refundAmount: payment.amount,
      refundReason: reason,
      refundedAt: new Date(),
    });
  }

  async getRiderHistory(riderId: string, dto: PaginationDto) {
    const [data, total] = await this.paymentRepo.findAndCount({
      where: { riderId },
      relations: ['trip'],
      skip: dto.skip,
      take: dto.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }
}
