import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppGateway }                    from './app.gateway';
import { LocationTrackerService }        from './location-tracker.service';
import { TripEventsService }             from './trip-events.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';

import { AuthModule }       from '../modules/auth/auth.module';
import { DriverProfile }    from '../modules/drivers/entities/driver-profile.entity';
import { Trip }             from '../modules/trips/entities/trip.entity';
import { TripPassenger }    from '../modules/trips/entities/trip-passenger.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([DriverProfile, Trip, TripPassenger]),
  ],
  providers: [
    AppGateway,
    LocationTrackerService,
    TripEventsService,
    NotificationDispatcherService,
  ],
  exports: [
    AppGateway,
    TripEventsService,
    NotificationDispatcherService,
    LocationTrackerService,
  ],
})
export class SocketsModule {}
