import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Version,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  @Index()
  userId: string;

  /** Balance stored in smallest currency unit (paise for INR, cents for USD) */
  @Column({ name: 'balance_paise', type: 'bigint', default: 0 })
  balancePaise: number;

  @Column({ name: 'currency', length: 3, default: 'INR' })
  currency: string;

  @Column({ name: 'is_frozen', default: false })
  isFrozen: boolean;

  /** Optimistic lock version — prevents double-spend race conditions */
  @Version()
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  get balanceDecimal(): number {
    return this.balancePaise / 100;
  }
}
