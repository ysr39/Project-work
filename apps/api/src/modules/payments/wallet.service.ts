import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { Wallet } from './entities/wallet.entity';
import { WalletTransaction, WalletTxType } from './entities/wallet-transaction.entity';
import { StripeService, WalletTopupOptions } from './stripe.service';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet) private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(WalletTransaction) private readonly txRepo: Repository<WalletTransaction>,
    private readonly stripeService: StripeService,
    private readonly dataSource: DataSource,
  ) {}

  /* ─── Get or create ───────────────────────────────────────────────────── */

  async getOrCreate(userId: string): Promise<Wallet> {
    let wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      wallet = await this.walletRepo.save(this.walletRepo.create({ userId }));
    }
    return wallet;
  }

  async getBalance(userId: string): Promise<{ balancePaise: number; balanceDecimal: number; currency: string }> {
    const wallet = await this.getOrCreate(userId);
    return {
      balancePaise:   Number(wallet.balancePaise),
      balanceDecimal: wallet.balanceDecimal,
      currency:       wallet.currency,
    };
  }

  /* ─── Top-up via Stripe ────────────────────────────────────────────────── */

  async initiateTopup(userId: string, amountRupees: number): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    walletId: string;
  }> {
    if (amountRupees < 10 || amountRupees > 50_000) {
      throw new BadRequestException('Top-up must be between ₹10 and ₹50,000');
    }

    const wallet = await this.getOrCreate(userId);
    if (wallet.isFrozen) throw new BadRequestException('Wallet is frozen');

    const amountPaise    = Math.round(amountRupees * 100);
    const idempotencyKey = `topup-${wallet.id}-${Date.now()}`;

    const opts: WalletTopupOptions = {
      amountPaise,
      userId,
      walletId:       wallet.id,
      idempotencyKey,
    };

    const intent = await this.stripeService.createWalletTopupIntent(opts);

    return {
      clientSecret:    intent.client_secret!,
      paymentIntentId: intent.id,
      walletId:        wallet.id,
    };
  }

  /** Called by webhook after payment_intent.succeeded for source='wallet_topup' */
  async creditFromStripe(opts: {
    walletId:             string;
    amountPaise:          number;
    stripePaymentIntentId: string;
    chargeId:             string;
  }): Promise<WalletTransaction> {
    const idempotencyKey = `stripe-topup-${opts.stripePaymentIntentId}`;

    const existing = await this.txRepo.findOne({ where: { idempotencyKey } });
    if (existing) return existing;

    return this.dataSource.transaction(async (em) => {
      const wallet = await em.findOne(Wallet, {
        where: { id: opts.walletId },
        lock:  { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');

      wallet.balancePaise = Number(wallet.balancePaise) + opts.amountPaise;
      await em.save(wallet);

      return em.save(
        em.create(WalletTransaction, {
          walletId:             wallet.id,
          type:                 WalletTxType.TOPUP,
          amountPaise:          opts.amountPaise,
          balanceAfterPaise:    wallet.balancePaise,
          description:          'Wallet top-up via Stripe',
          referenceId:          opts.chargeId,
          stripePaymentIntentId: opts.stripePaymentIntentId,
          idempotencyKey,
        }),
      );
    });
  }

  /* ─── Debit for ride payment ───────────────────────────────────────────── */

  async debitForRide(opts: {
    userId:    string;
    amountRupees: number;
    tripId:    string;
    passengerId: string;
  }): Promise<WalletTransaction> {
    const amountPaise    = Math.round(opts.amountRupees * 100);
    const idempotencyKey = `ride-debit-${opts.passengerId}`;

    const existing = await this.txRepo.findOne({ where: { idempotencyKey } });
    if (existing) return existing;

    return this.dataSource.transaction(async (em) => {
      const wallet = await em.findOne(Wallet, {
        where: { userId: opts.userId },
        lock:  { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');
      if (wallet.isFrozen) throw new BadRequestException('Wallet is frozen');

      const currentBalance = Number(wallet.balancePaise);
      if (currentBalance < amountPaise) {
        throw new BadRequestException(
          `Insufficient wallet balance. Need ₹${opts.amountRupees}, have ₹${currentBalance / 100}`,
        );
      }

      wallet.balancePaise = currentBalance - amountPaise;
      await em.save(wallet);

      return em.save(
        em.create(WalletTransaction, {
          walletId:          wallet.id,
          type:              WalletTxType.RIDE_DEBIT,
          amountPaise:       -amountPaise,
          balanceAfterPaise: wallet.balancePaise,
          description:       `Ride payment – trip ${opts.tripId}`,
          referenceId:       opts.tripId,
          idempotencyKey,
        }),
      );
    });
  }

  /* ─── Credit refund back to wallet ───────────────────────────────────── */

  async creditRefund(opts: {
    userId:       string;
    amountRupees: number;
    tripId:       string;
    paymentId:    string;
  }): Promise<WalletTransaction> {
    const amountPaise    = Math.round(opts.amountRupees * 100);
    const idempotencyKey = `refund-credit-${opts.paymentId}`;

    const existing = await this.txRepo.findOne({ where: { idempotencyKey } });
    if (existing) return existing;

    return this.dataSource.transaction(async (em) => {
      const wallet = await em.findOne(Wallet, {
        where: { userId: opts.userId },
        lock:  { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');

      wallet.balancePaise = Number(wallet.balancePaise) + amountPaise;
      await em.save(wallet);

      return em.save(
        em.create(WalletTransaction, {
          walletId:          wallet.id,
          type:              WalletTxType.REFUND_CREDIT,
          amountPaise:       amountPaise,
          balanceAfterPaise: wallet.balancePaise,
          description:       `Refund for trip ${opts.tripId}`,
          referenceId:       opts.tripId,
          idempotencyKey,
        }),
      );
    });
  }

  /* ─── History ─────────────────────────────────────────────────────────── */

  async getTransactions(userId: string, dto: PaginationDto) {
    const wallet = await this.getOrCreate(userId);
    const [data, total] = await this.txRepo.findAndCount({
      where: { walletId: wallet.id },
      skip:  dto.skip,
      take:  dto.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }
}
