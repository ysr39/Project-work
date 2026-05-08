import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import { DriverPayout } from './entities/driver-payout.entity';
import { Payment } from './entities/payment.entity';
import { DriverProfile } from '../drivers/entities/driver-profile.entity';
import { StripeService } from './stripe.service';
import { PayoutStatus, PaymentStatus } from '../../common/constants/trip-status.enum';

const COMMISSION_RATE = 20;

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    @InjectRepository(DriverPayout) private readonly payoutRepo: Repository<DriverPayout>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(DriverProfile) private readonly driverRepo: Repository<DriverProfile>,
    private readonly stripeService: StripeService,
  ) {}

  @Cron(CronExpression.EVERY_WEEK)
  async runWeeklyPayouts() {
    this.logger.log('Running weekly driver payouts...');
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodEnd.getDate() - 7);

    const drivers = await this.driverRepo.find({
      where: { approvalStatus: 'APPROVED' as any },
    });

    for (const driver of drivers) {
      try {
        await this.processDriverPayout(driver, periodStart, periodEnd);
      } catch (err) {
        this.logger.error(`Payout failed for driver ${driver.id}`, err);
      }
    }
  }

  async processDriverPayout(driver: DriverProfile, periodStart: Date, periodEnd: Date) {
    const payments = await this.paymentRepo.find({
      where: {
        status: PaymentStatus.CAPTURED,
        createdAt: Between(periodStart, periodEnd),
      },
      relations: ['trip'],
    });

    const driverPayments = payments.filter((p) => p.trip?.driverId === driver.id);
    if (!driverPayments.length) return;

    const gross = driverPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const commission = +(gross * (COMMISSION_RATE / 100)).toFixed(2);
    const net = +(gross - commission).toFixed(2);

    const existing = await this.payoutRepo.findOne({
      where: { driverId: driver.id, periodStart, periodEnd },
    });
    if (existing) return;

    const payout = await this.payoutRepo.save(
      this.payoutRepo.create({
        driverId: driver.id,
        periodStart,
        periodEnd,
        tripsCount: driverPayments.length,
        grossEarnings: gross,
        commissionRate: COMMISSION_RATE,
        commissionAmount: commission,
        netEarnings: net,
        status: PayoutStatus.PROCESSING,
      }),
    );

    if (!driver.stripeAccountId) {
      await this.payoutRepo.update(payout.id, {
        status: PayoutStatus.FAILED,
        failureReason: 'No Stripe Connect account linked',
      });
      return;
    }

    try {
      const transfer = await this.stripeService.transferToDriver(
        driver.stripeAccountId,
        Math.round(net * 100),
        `TaxiPool payout ${periodStart.toISOString().split('T')[0]} – ${periodEnd.toISOString().split('T')[0]}`,
      );

      await this.payoutRepo.update(payout.id, {
        status: PayoutStatus.PAID,
        stripeTransferId: transfer.id,
        paidAt: new Date(),
      });
    } catch (err) {
      await this.payoutRepo.update(payout.id, {
        status: PayoutStatus.FAILED,
        failureReason: err.message,
      });
    }
  }
}
