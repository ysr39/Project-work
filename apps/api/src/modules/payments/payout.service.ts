import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';

import { DriverPayout } from './entities/driver-payout.entity';
import { Payment } from './entities/payment.entity';
import { DriverProfile } from '../drivers/entities/driver-profile.entity';
import { StripeService } from './stripe.service';
import { CommissionService } from './commission.service';
import { PayoutStatus, PaymentStatus } from '../../common/constants/trip-status.enum';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    @InjectRepository(DriverPayout) private readonly payoutRepo:  Repository<DriverPayout>,
    @InjectRepository(Payment)      private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(DriverProfile) private readonly driverRepo: Repository<DriverProfile>,
    private readonly stripeService:     StripeService,
    private readonly commissionService: CommissionService,
    private readonly dataSource:        DataSource,
  ) {}

  /* ─── Scheduled weekly payouts ───────────────────────────────────────── */

  @Cron(CronExpression.EVERY_WEEK)
  async runWeeklyPayouts(): Promise<void> {
    this.logger.log('Running weekly driver payouts…');
    const periodEnd   = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodEnd.getDate() - 7);

    const drivers = await this.driverRepo.find({
      where: { approvalStatus: 'APPROVED' as any },
    });

    for (const driver of drivers) {
      try {
        await this.processDriverPayout(driver.id, periodStart, periodEnd);
      } catch (err: any) {
        this.logger.error(`Payout failed for driver ${driver.id}`, err);
      }
    }
  }

  /* ─── Core payout logic ──────────────────────────────────────────────── */

  async processDriverPayout(
    driverId: string,
    periodStart: Date,
    periodEnd:   Date,
  ): Promise<DriverPayout | null> {
    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    // Idempotency — skip if payout already exists for this period
    const existing = await this.payoutRepo.findOne({
      where: { driverId, periodStart, periodEnd },
    });
    if (existing) return existing;

    // Gather captured ride payments for this driver in the period
    const payments = await this.paymentRepo
      .createQueryBuilder('p')
      .innerJoin('p.trip', 'trip')
      .where('trip.driverId = :driverId', { driverId })
      .andWhere('p.status = :status', { status: PaymentStatus.CAPTURED })
      .andWhere('p.createdAt BETWEEN :start AND :end', { start: periodStart, end: periodEnd })
      .getMany();

    if (!payments.length) return null;

    // Monthly trip count for commission tier calculation
    const monthStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
    const monthEnd   = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0, 23, 59, 59);
    const monthlyTrips = await this.paymentRepo
      .createQueryBuilder('p')
      .innerJoin('p.trip', 'trip')
      .where('trip.driverId = :driverId', { driverId })
      .andWhere('p.status = :status', { status: PaymentStatus.CAPTURED })
      .andWhere('p.createdAt BETWEEN :start AND :end', { start: monthStart, end: monthEnd })
      .getCount();

    const grossEarnings = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const breakdown     = this.commissionService.compute(grossEarnings, monthlyTrips);

    const payout = await this.payoutRepo.save(
      this.payoutRepo.create({
        driverId,
        periodStart,
        periodEnd,
        tripsCount:       payments.length,
        grossEarnings:    breakdown.grossEarnings,
        commissionRate:   breakdown.commissionRate,
        commissionAmount: breakdown.commissionAmount,
        netEarnings:      breakdown.netEarnings,
        status:           PayoutStatus.PROCESSING,
      }),
    );

    if (!driver.stripeAccountId) {
      await this.payoutRepo.update(payout.id, {
        status:        PayoutStatus.FAILED,
        failureReason: 'No Stripe Connect account linked',
      });
      return { ...payout, status: PayoutStatus.FAILED } as DriverPayout;
    }

    try {
      const netPaise = this.commissionService.toPaise(breakdown.netEarnings);
      const period   = `${periodStart.toISOString().split('T')[0]} – ${periodEnd.toISOString().split('T')[0]}`;
      const transfer = await this.stripeService.transferToDriver({
        destinationAccountId: driver.stripeAccountId,
        amountPaise:          netPaise,
        description:          `TaxiPool payout ${period}`,
        idempotencyKey:       `payout-${payout.id}`,
      });

      await this.payoutRepo.update(payout.id, {
        status:           PayoutStatus.PAID,
        stripeTransferId: transfer.id,
        paidAt:           new Date(),
      });

      this.logger.log(`Payout ${payout.id} paid — ₹${breakdown.netEarnings} → driver ${driverId}`);
      return { ...payout, status: PayoutStatus.PAID, stripeTransferId: transfer.id } as DriverPayout;
    } catch (err: any) {
      await this.payoutRepo.update(payout.id, {
        status:        PayoutStatus.FAILED,
        failureReason: err.message,
      });
      throw err;
    }
  }

  /* ─── Admin: manual trigger ──────────────────────────────────────────── */

  async triggerManualPayout(
    driverId: string,
    opts: { periodStart: Date; periodEnd: Date },
  ): Promise<DriverPayout | null> {
    return this.processDriverPayout(driverId, opts.periodStart, opts.periodEnd);
  }

  /* ─── Admin: retry failed payouts ───────────────────────────────────── */

  async retryFailedPayouts(): Promise<{ retried: number; succeeded: number }> {
    const failed = await this.payoutRepo.find({
      where: { status: PayoutStatus.FAILED },
      relations: ['driver'],
    });

    let succeeded = 0;
    for (const payout of failed) {
      const driver = await this.driverRepo.findOne({ where: { id: payout.driverId } });
      if (!driver?.stripeAccountId) continue;

      try {
        // Reset to PROCESSING so processDriverPayout won't skip it (idempotency check uses period, not id)
        await this.payoutRepo.update(payout.id, { status: PayoutStatus.PROCESSING });

        const netPaise = this.commissionService.toPaise(Number(payout.netEarnings));
        const period   = `${payout.periodStart.toISOString().split('T')[0]} – ${payout.periodEnd.toISOString().split('T')[0]}`;
        const transfer = await this.stripeService.transferToDriver({
          destinationAccountId: driver.stripeAccountId,
          amountPaise:          netPaise,
          description:          `TaxiPool payout ${period} (retry)`,
          idempotencyKey:       `payout-retry-${payout.id}`,
        });

        await this.payoutRepo.update(payout.id, {
          status:           PayoutStatus.PAID,
          stripeTransferId: transfer.id,
          paidAt:           new Date(),
        });
        succeeded++;
      } catch (err: any) {
        await this.payoutRepo.update(payout.id, {
          status:        PayoutStatus.FAILED,
          failureReason: err.message,
        });
        this.logger.warn(`Retry failed for payout ${payout.id}`, err);
      }
    }

    return { retried: failed.length, succeeded };
  }

  /* ─── Stripe Connect onboarding ─────────────────────────────────────── */

  async initiateOnboarding(
    driverId: string,
    baseUrl:  string,
  ): Promise<{ accountId: string; onboardingUrl: string }> {
    const driver = await this.driverRepo.findOne({
      where:     { id: driverId },
      relations: ['user'],
    });
    if (!driver) throw new NotFoundException('Driver not found');

    let accountId = driver.stripeAccountId;
    if (!accountId) {
      const email   = (driver as any).user?.phone ?? driverId;
      const account = await this.stripeService.createConnectAccount(email, driverId);
      accountId = account.id;
      await this.driverRepo.update(driverId, { stripeAccountId: accountId });
    }

    const link = await this.stripeService.createAccountLink(accountId, baseUrl);
    return { accountId, onboardingUrl: link.url };
  }

  async getOnboardingStatus(driverId: string): Promise<{
    accountId:        string | null;
    chargesEnabled:   boolean;
    detailsSubmitted: boolean;
    payoutsEnabled:   boolean;
  }> {
    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    if (!driver.stripeAccountId) {
      return { accountId: null, chargesEnabled: false, detailsSubmitted: false, payoutsEnabled: false };
    }

    const account = await this.stripeService.retrieveAccount(driver.stripeAccountId);
    return {
      accountId:        account.id,
      chargesEnabled:   account.charges_enabled,
      detailsSubmitted: account.details_submitted,
      payoutsEnabled:   account.payouts_enabled ?? false,
    };
  }

  /* ─── Queries ─────────────────────────────────────────────────────────── */

  async getDriverPayoutHistory(driverId: string, dto: PaginationDto) {
    const [data, total] = await this.payoutRepo.findAndCount({
      where: { driverId },
      skip:  dto.skip,
      take:  dto.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }

  async getAllPayouts(dto: PaginationDto & { status?: PayoutStatus }) {
    const where = dto.status ? { status: dto.status } : {};
    const [data, total] = await this.payoutRepo.findAndCount({
      where,
      relations: ['driver'],
      skip:  dto.skip,
      take:  dto.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }

  async getPayoutSummary(driverId: string): Promise<{
    totalPaid:        number;
    totalCommission:  number;
    totalGross:       number;
    pendingCount:     number;
    commissionTier:   string;
    monthlyTrips:     number;
  }> {
    const paid = await this.payoutRepo
      .createQueryBuilder('p')
      .select('SUM(p.netEarnings)',      'totalPaid')
      .addSelect('SUM(p.commissionAmount)', 'totalCommission')
      .addSelect('SUM(p.grossEarnings)', 'totalGross')
      .where('p.driverId = :driverId', { driverId })
      .andWhere('p.status = :status',  { status: PayoutStatus.PAID })
      .getRawOne();

    const pendingCount = await this.payoutRepo.count({
      where: { driverId, status: PayoutStatus.PROCESSING },
    });

    // Current month trip count → tier label
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const monthlyTrips = await this.paymentRepo
      .createQueryBuilder('p')
      .innerJoin('p.trip', 'trip')
      .where('trip.driverId = :driverId', { driverId })
      .andWhere('p.status = :status', { status: PaymentStatus.CAPTURED })
      .andWhere('p.createdAt BETWEEN :start AND :end', { start: monthStart, end: monthEnd })
      .getCount();

    const { tier } = this.commissionService.compute(0, monthlyTrips);

    return {
      totalPaid:       Number(paid?.totalPaid ?? 0),
      totalCommission: Number(paid?.totalCommission ?? 0),
      totalGross:      Number(paid?.totalGross ?? 0),
      pendingCount,
      commissionTier:  tier,
      monthlyTrips,
    };
  }
}
