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
import { DriverProfile } from './driver-profile.entity';
import { VehicleType } from '../../../common/constants/roles.enum';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'driver_id' })
  @Index()
  driverId: string;

  @Column({ length: 50 })
  make: string;

  @Column({ length: 50 })
  model: string;

  @Column({ type: 'smallint' })
  year: number;

  @Column({ length: 30 })
  color: string;

  @Column({ name: 'plate_number', length: 20, unique: true })
  plateNumber: string;

  @Column({ name: 'vehicle_type', type: 'enum', enum: VehicleType, default: VehicleType.SEDAN })
  vehicleType: VehicleType;

  @Column({ type: 'smallint', default: 4 })
  capacity: number;

  @Column({ name: 'registration_number', length: 50, unique: true })
  registrationNumber: string;

  @Column({ name: 'insurance_expiry', type: 'date' })
  insuranceExpiry: Date;

  @Column({ name: 'is_active', default: true })
  @Index()
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => DriverProfile, (d) => d.vehicles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: DriverProfile;
}
