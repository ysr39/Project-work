import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectDriverDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class PricingConfigDto {
  @IsOptional() baseFare?: number;
  @IsOptional() perKmRate?: number;
  @IsOptional() perMinRate?: number;
  @IsOptional() minimumFare?: number;
  @IsOptional() poolDiscountPct?: number;
  @IsOptional() surgeMultiplier?: number;
  @IsOptional() surgeActive?: boolean;
}
