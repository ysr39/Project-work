import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { PaymentMethod } from '../../../common/constants/trip-status.enum';

export class CreatePaymentIntentDto {
  @ApiProperty()
  @IsUUID()
  tripPassengerId: string;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.CARD })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod = PaymentMethod.CARD;
}
