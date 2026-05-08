import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsString, IsNotEmpty, Max, Min } from 'class-validator';
import { TripType } from '../../../common/constants/trip-status.enum';

export class CreateTripDto {
  @ApiProperty({ enum: TripType, default: TripType.POOL })
  @IsEnum(TripType)
  tripType: TripType = TripType.POOL;

  @ApiProperty({ example: '123 Main St, City' })
  @IsString()
  @IsNotEmpty()
  pickupAddress: string;

  @ApiProperty({ example: 37.7749 })
  @IsNumber()
  pickupLat: number;

  @ApiProperty({ example: -122.4194 })
  @IsNumber()
  pickupLng: number;

  @ApiProperty({ example: '456 Market St, City' })
  @IsString()
  @IsNotEmpty()
  dropoffAddress: string;

  @ApiProperty({ example: 37.7921 })
  @IsNumber()
  dropoffLat: number;

  @ApiProperty({ example: -122.3972 })
  @IsNumber()
  dropoffLng: number;

  @ApiProperty({ example: 1, minimum: 1, maximum: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  seatsRequested: number = 1;
}
