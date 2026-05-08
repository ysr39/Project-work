import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TripType, TripStatus } from '../../../common/constants/trip-status.enum';
import { DriverProfile } from '../../drivers/entities/driver-profile.entity';
import { Vehicle } from '../../drivers/entities/vehicle.entity';
import { TripPassenger } from './trip-passenger.entity';
import { TripStop } from './trip-stop.entity';

@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_type', type: 'enum', enum: TripType, default: TripType.POOL })
  tripType: TripType;

  @Column({ name: 'status', type: 'enum', enum: TripStatus, default: TripStatus.SEARCHING })
  @Index()
  status: TripStatus;

  @Column({ name: 'driver_id', nullable: true })
  @Index()
  driverId: string;

  @Column({ name: 'vehicle_id', nullable: true })
  vehicleId: string;

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

  @Column({ name: 'route_polyline', nullable: true, type: 'text' })
  routePolyline: string;

  @Column({ name: 'total_distance_km', type: 'decimal', precision: 8, scale: 2, nullable: true })
  totalDistanceKm: number;

  @Column({ name: 'total_duration_min', type: 'decimal', precision: 8, scale: 2, nullable: true })
  totalDurationMin: number;

  @Column({ name: 'total_seats', type: 'smallint', default: 3 })
  totalSeats: number;

  @Column({ name: 'seats_filled', type: 'smallint', default: 0 })
  seatsFilled: number;

  @Column({ name: 'base_fare', type: 'decimal', precision: 8, scale: 2 })
  baseFare: number;

  @Column({ name: 'per_km_rate', type: 'decimal', precision: 8, scale: 2 })
  perKmRate: number;

  @Column({ name: 'surge_multiplier', type: 'decimal', precision: 4, scale: 2, default: 1 })
  surgeMultiplier: number;

  @Column({ name: 'pool_discount_pct', type: 'decimal', precision: 5, scale: 2, default: 0 })
  poolDiscountPct: number;

  @Column({ name: 'total_fare', type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalFare: number;

  @Column({ name: 'cancelled_by', nullable: true })
  cancelledBy: string;

  @Column({ name: 'cancellation_reason', nullable: true })
  cancellationReason: string;

  @Column({ name: 'cancellation_fee', type: 'decimal', precision: 8, scale: 2, default: 0 })
  cancellationFee: number;

  @Column({ name: 'matched_at', type: 'timestamptz', nullable: true })
  matchedAt: Date;

  @Column({ name: 'driver_arrived_at', type: 'timestamptz', nullable: true })
  driverArrivedAt: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => DriverProfile, { nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: DriverProfile;

  @ManyToOne(() => Vehicle, { nullable: true })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @OneToMany(() => TripPassenger, (p) => p.trip, { cascade: true })
  passengers: TripPassenger[];

  @OneToMany(() => TripStop, (s) => s.trip, { cascade: true })
  stops: TripStop[];
}
