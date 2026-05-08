import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { TripType } from '../../../common/constants/trip-status.enum';

export class PoolRequestDto {
  @ApiProperty({ enum: TripType, default: TripType.POOL })
  @IsEnum(TripType)
  tripType: TripType = TripType.POOL;

  @ApiProperty()
  @IsString()
  pickupAddress: string;

  @ApiProperty()
  @IsNumber()
  pickupLat: number;

  @ApiProperty()
  @IsNumber()
  pickupLng: number;

  @ApiProperty()
  @IsString()
  dropoffAddress: string;

  @ApiProperty()
  @IsNumber()
  dropoffLat: number;

  @ApiProperty()
  @IsNumber()
  dropoffLng: number;

  @ApiProperty({ minimum: 1, maximum: 3, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  seatsRequested: number = 1;

  @ApiPropertyOptional({ description: 'Promo code' })
  @IsOptional()
  @IsString()
  promoCode?: string;
}

export class FareEstimateDto {
  @ApiProperty()
  @IsNumber()
  pickupLat: number;

  @ApiProperty()
  @IsNumber()
  pickupLng: number;

  @ApiProperty()
  @IsNumber()
  dropoffLat: number;

  @ApiProperty()
  @IsNumber()
  dropoffLng: number;

  @ApiProperty({ minimum: 1, maximum: 3, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  seatsRequested: number = 1;
}
