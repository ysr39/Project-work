import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Wallet } from './wallet.entity';

export enum WalletTxType {
  TOPUP           = 'TOPUP',           // rider adds money via Stripe
  RIDE_DEBIT      = 'RIDE_DEBIT',      // fare deducted for a trip
  REFUND_CREDIT   = 'REFUND_CREDIT',   // refund posted back to wallet
  CASHBACK        = 'CASHBACK',        // promo cashback
  PAYOUT          = 'PAYOUT',          // driver withdrawal (future)
  ADJUSTMENT      = 'ADJUSTMENT',      // admin manual correction
}

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id' })
  @Index()
  walletId: string;

  @Column({ name: 'type', type: 'enum', enum: WalletTxType })
  @Index()
  type: WalletTxType;

  /** Positive = credit, Negative = debit (in paise) */
  @Column({ name: 'amount_paise', type: 'bigint' })
  amountPaise: number;

  @Column({ name: 'balance_after_paise', type: 'bigint' })
  balanceAfterPaise: number;

  @Column({ name: 'description', nullable: true })
  description: string;

  @Column({ name: 'reference_id', nullable: true })
  @Index()
  referenceId: string;    // tripId, paymentId, stripeChargeId, etc.

  @Column({ name: 'stripe_payment_intent_id', nullable: true })
  stripePaymentIntentId: string;

  /** Idempotency key ensures no duplicate transactions */
  @Column({ name: 'idempotency_key', unique: true, nullable: true })
  idempotencyKey: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;
}
