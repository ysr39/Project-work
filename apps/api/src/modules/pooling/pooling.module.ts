import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PoolingController } from './pooling.controller';
import { PoolingService } from './pooling.service';
import { MatchingService } from './matching.service';
import { CancellationService } from './cancellation.service';
import { FareService } from './fare.service';
import { RouteService } from './route.service';

import { Trip } from '../trips/entities/trip.entity';
import { TripPassenger } from '../trips/entities/trip-passenger.entity';
import { TripStop } from '../trips/entities/trip-stop.entity';
import { DriverProfile } from '../drivers/entities/driver-profile.entity';
import { Vehicle } from '../drivers/entities/vehicle.entity';
import { Payment } from '../payments/entities/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, TripPassenger, TripStop, DriverProfile, Vehicle, Payment]),
  ],
  controllers: [PoolingController],
  providers: [PoolingService, MatchingService, CancellationService, FareService, RouteService],
  exports: [PoolingService, MatchingService, CancellationService, FareService, RouteService],
})
export class PoolingModule {}
