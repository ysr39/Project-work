import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, Max } from 'class-validator';

export class WalletTopupDto {
  @ApiProperty({ example: 500, description: 'Top-up amount in rupees (₹10 – ₹50,000)' })
  @IsNumber()
  @Min(10)
  @Max(50_000)
  amountRupees: number;
}
