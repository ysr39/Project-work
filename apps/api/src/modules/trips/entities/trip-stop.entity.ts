import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Trip } from './trip.entity';
import { TripPassenger } from './trip-passenger.entity';
import { StopType } from '../../../common/constants/trip-status.enum';

@Entity('trip_stops')
export class TripStop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id' })
  @Index()
  tripId: string;

  @Column({ name: 'trip_passenger_id' })
  tripPassengerId: string;

  @Column({ name: 'stop_type', type: 'enum', enum: StopType })
  stopType: StopType;

  @Column()
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng: number;

  @Column({ name: 'sequence_order', type: 'smallint' })
  sequenceOrder: number;

  @Column({ name: 'eta', type: 'timestamptz', nullable: true })
  eta: Date;

  @Column({ name: 'arrived_at', type: 'timestamptz', nullable: true })
  arrivedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Trip, (t) => t.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @ManyToOne(() => TripPassenger)
  @JoinColumn({ name: 'trip_passenger_id' })
  passenger: TripPassenger;
}
