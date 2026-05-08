import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Trip } from '../../trips/entities/trip.entity';
import { User } from '../../users/entities/user.entity';
import { TripPassenger } from '../../trips/entities/trip-passenger.entity';
import { PaymentStatus, PaymentMethod } from '../../../common/constants/trip-status.enum';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id' })
  @Index()
  tripId: string;

  @Column({ name: 'trip_passenger_id', unique: true })
  tripPassengerId: string;

  @Column({ name: 'rider_id' })
  @Index()
  riderId: string;

  @Column({ name: 'amount', type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ name: 'currency', length: 3, default: 'USD' })
  currency: string;

  @Column({ name: 'status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  @Index()
  status: PaymentStatus;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod, default: PaymentMethod.CARD })
  paymentMethod: PaymentMethod;

  @Column({ name: 'stripe_payment_intent_id', length: 100, unique: true, nullable: true })
  stripePaymentIntentId: string;

  @Column({ name: 'stripe_charge_id', nullable: true })
  stripeChargeId: string;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  refundAmount: number;

  @Column({ name: 'refund_reason', nullable: true })
  refundReason: string;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt: Date;

  @Column({ name: 'captured_at', type: 'timestamptz', nullable: true })
  capturedAt: Date;

  @Column({ name: 'failed_reason', nullable: true })
  failedReason: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Trip)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'rider_id' })
  rider: User;

  @ManyToOne(() => TripPassenger)
  @JoinColumn({ name: 'trip_passenger_id' })
  tripPassenger: TripPassenger;
}
