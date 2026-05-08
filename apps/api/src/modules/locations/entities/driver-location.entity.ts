import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('driver_location_history')
export class DriverLocationHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'driver_id' })
  @Index()
  driverId: string;

  @Column({ name: 'trip_id', nullable: true })
  @Index()
  tripId: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  heading: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  speed: number;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  @Index()
  recordedAt: Date;
}
