import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Vehicle } from './vehicle.entity';
import { DriverDocument } from './driver-document.entity';
import { DriverApprovalStatus } from '../../../common/constants/roles.enum';

@Entity('driver_profiles')
export class DriverProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  @Index()
  userId: string;

  @Column({ name: 'license_number', length: 50, unique: true })
  licenseNumber: string;

  @Column({ name: 'license_expiry', type: 'date' })
  licenseExpiry: Date;

  @Column({
    name: 'approval_status',
    type: 'enum',
    enum: DriverApprovalStatus,
    default: DriverApprovalStatus.PENDING,
  })
  @Index()
  approvalStatus: DriverApprovalStatus;

  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason: string;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ name: 'is_online', default: false })
  @Index()
  isOnline: boolean;

  @Column({ name: 'current_heading', type: 'decimal', precision: 5, scale: 2, nullable: true })
  currentHeading: number;

  @Column({ name: 'current_speed', type: 'decimal', precision: 5, scale: 2, nullable: true })
  currentSpeed: number;

  @Column({ name: 'last_location_at', type: 'timestamptz', nullable: true })
  lastLocationAt: Date;

  @Column({ name: 'rating_avg', type: 'decimal', precision: 3, scale: 2, default: 5.0 })
  ratingAvg: number;

  @Column({ name: 'total_trips', default: 0 })
  totalTrips: number;

  @Column({ name: 'total_earnings', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalEarnings: number;

  @Column({ name: 'stripe_account_id', length: 100, nullable: true })
  stripeAccountId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Vehicle, (v) => v.driver)
  vehicles: Vehicle[];

  @OneToMany(() => DriverDocument, (d) => d.driver)
  documents: DriverDocument[];
}
