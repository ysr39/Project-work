import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RefundDto {
  @ApiPropertyOptional({ example: 150, description: 'Partial refund amount in rupees; omit for full refund' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amountRupees?: number;

  @ApiPropertyOptional({ example: 'Driver did not arrive' })
  @IsOptional()
  @IsString()
  reason?: string;
}
