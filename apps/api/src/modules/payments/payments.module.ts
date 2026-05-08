import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { PaymentsController }  from './payments.controller';
import { PaymentsService }     from './payments.service';
import { StripeService }       from './stripe.service';
import { PayoutService }       from './payout.service';
import { WalletService }       from './wallet.service';
import { CommissionService }   from './commission.service';

import { Payment }             from './entities/payment.entity';
import { DriverPayout }        from './entities/driver-payout.entity';
import { Wallet }              from './entities/wallet.entity';
import { WalletTransaction }   from './entities/wallet-transaction.entity';
import { TripPassenger }       from '../trips/entities/trip-passenger.entity';
import { DriverProfile }       from '../drivers/entities/driver-profile.entity';
import { User }                from '../users/entities/user.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      Payment,
      DriverPayout,
      Wallet,
      WalletTransaction,
      TripPassenger,
      DriverProfile,
      User,
    ]),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    StripeService,
    PayoutService,
    WalletService,
    CommissionService,
  ],
  exports: [PaymentsService, StripeService, WalletService, CommissionService],
})
export class PaymentsModule {}
