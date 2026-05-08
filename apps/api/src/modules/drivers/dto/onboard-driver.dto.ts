import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VehicleType } from '../../../common/constants/roles.enum';

export class OnboardDriverDto {
  @ApiProperty()
  @IsString()
  @Length(5, 50)
  licenseNumber: string;

  @ApiProperty({ example: '2027-12-31' })
  @IsDateString()
  licenseExpiry: string;

  @ApiProperty()
  @IsString()
  @MaxLength(50)
  vehicleMake: string;

  @ApiProperty()
  @IsString()
  @MaxLength(50)
  vehicleModel: string;

  @ApiProperty({ example: 2022 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(new Date().getFullYear() + 1)
  vehicleYear: number;

  @ApiProperty()
  @IsString()
  @MaxLength(30)
  vehicleColor: string;

  @ApiProperty()
  @IsString()
  @Length(4, 20)
  plateNumber: string;

  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiProperty()
  @IsString()
  @Length(5, 50)
  registrationNumber: string;

  @ApiProperty({ example: '2027-12-31' })
  @IsDateString()
  insuranceExpiry: string;
}
