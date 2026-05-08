import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { PayoutService } from './payout.service';
import { Payment } from './entities/payment.entity';
import { DriverPayout } from './entities/driver-payout.entity';
import { TripPassenger } from '../trips/entities/trip-passenger.entity';
import { DriverProfile } from '../drivers/entities/driver-profile.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Payment, DriverPayout, TripPassenger, DriverProfile]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService, PayoutService],
  exports: [PaymentsService, StripeService],
})
export class PaymentsModule {}
