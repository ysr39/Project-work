import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { TripFsmService } from './trip-fsm.service';
import { Trip } from './entities/trip.entity';
import { TripPassenger } from './entities/trip-passenger.entity';
import { TripStop } from './entities/trip-stop.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, TripPassenger, TripStop])],
  controllers: [TripsController],
  providers: [TripsService, TripFsmService],
  exports: [TripsService, TypeOrmModule],
})
export class TripsModule {}
