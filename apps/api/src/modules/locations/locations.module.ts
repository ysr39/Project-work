import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverLocationHistory } from './entities/driver-location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DriverLocationHistory])],
  exports: [TypeOrmModule],
})
export class LocationsModule {}
