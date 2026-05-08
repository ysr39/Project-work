import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchingService } from './matching.service';
import { FareService } from './fare.service';
import { RouteService } from './route.service';
import { Trip } from '../trips/entities/trip.entity';
import { TripPassenger } from '../trips/entities/trip-passenger.entity';
import { TripStop } from '../trips/entities/trip-stop.entity';
import { DriverProfile } from '../drivers/entities/driver-profile.entity';
import { Vehicle } from '../drivers/entities/vehicle.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, TripPassenger, TripStop, DriverProfile, Vehicle])],
  providers: [MatchingService, FareService, RouteService],
  exports: [MatchingService, FareService, RouteService],
})
export class PoolingModule {}
