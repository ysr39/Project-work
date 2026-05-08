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
import { Trip } from './trip.entity';
import { User } from '../../users/entities/user.entity';
import { PassengerStatus } from '../../../common/constants/trip-status.enum';

@Entity('trip_passengers')
@Unique(['tripId', 'riderId'])
export class TripPassenger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id' })
  @Index()
  tripId: string;

  @Column({ name: 'rider_id' })
  @Index()
  riderId: string;

  @Column({ name: 'status', type: 'enum', enum: PassengerStatus, default: PassengerStatus.CONFIRMED })
  @Index()
  status: PassengerStatus;

  @Column({ name: 'seats_requested', type: 'smallint', default: 1 })
  seatsRequested: number;

  @Column({ name: 'pickup_address' })
  pickupAddress: string;

  @Column({ name: 'pickup_lat', type: 'decimal', precision: 10, scale: 7 })
  pickupLat: number;

  @Column({ name: 'pickup_lng', type: 'decimal', precision: 10, scale: 7 })
  pickupLng: number;

  @Column({ name: 'dropoff_address' })
  dropoffAddress: string;

  @Column({ name: 'dropoff_lat', type: 'decimal', precision: 10, scale: 7 })
  dropoffLat: number;

  @Column({ name: 'dropoff_lng', type: 'decimal', precision: 10, scale: 7 })
  dropoffLng: number;

  @Column({ name: 'pickup_order', type: 'smallint', default: 1 })
  pickupOrder: number;

  @Column({ name: 'dropoff_order', type: 'smallint', default: 1 })
  dropoffOrder: number;

  @Column({ name: 'fare_amount', type: 'decimal', precision: 10, scale: 2 })
  fareAmount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 8, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'final_fare', type: 'decimal', precision: 10, scale: 2 })
  finalFare: number;

  @Column({ name: 'picked_up_at', type: 'timestamptz', nullable: true })
  pickedUpAt: Date;

  @Column({ name: 'dropped_off_at', type: 'timestamptz', nullable: true })
  droppedOffAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Trip, (t) => t.passengers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'rider_id' })
  rider: User;
}
