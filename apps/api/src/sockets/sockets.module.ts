import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppGateway } from './app.gateway';
import { AuthModule } from '../modules/auth/auth.module';
import { DriverProfile } from '../modules/drivers/entities/driver-profile.entity';
import { Trip } from '../modules/trips/entities/trip.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([DriverProfile, Trip])],
  providers: [AppGateway],
  exports: [AppGateway],
})
export class SocketsModule {}
