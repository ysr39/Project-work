import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { DriverProfile } from '../../drivers/entities/driver-profile.entity';
import { PayoutStatus } from '../../../common/constants/trip-status.enum';

@Entity('driver_payouts')
@Unique(['driverId', 'periodStart', 'periodEnd'])
export class DriverPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'driver_id' })
  @Index()
  driverId: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: Date;

  @Column({ name: 'trips_count', default: 0 })
  tripsCount: number;

  @Column({ name: 'gross_earnings', type: 'decimal', precision: 12, scale: 2 })
  grossEarnings: number;

  @Column({ name: 'commission_rate', type: 'decimal', precision: 5, scale: 2 })
  commissionRate: number;

  @Column({ name: 'commission_amount', type: 'decimal', precision: 12, scale: 2 })
  commissionAmount: number;

  @Column({ name: 'net_earnings', type: 'decimal', precision: 12, scale: 2 })
  netEarnings: number;

  @Column({ name: 'status', type: 'enum', enum: PayoutStatus, default: PayoutStatus.PENDING })
  @Index()
  status: PayoutStatus;

  @Column({ name: 'stripe_transfer_id', unique: true, nullable: true })
  stripeTransferId: string;

  @Column({ name: 'failure_reason', nullable: true })
  failureReason: string;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => DriverProfile)
  @JoinColumn({ name: 'driver_id' })
  driver: DriverProfile;
}
