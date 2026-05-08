import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { User } from '../users/entities/user.entity';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Create Stripe PaymentIntent for a ride' })
  createIntent(@CurrentUser() user: User, @Body() dto: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(user.id, dto);
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Stripe webhook handler (internal)' })
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentsService.handleWebhook(req.rawBody, signature);
  }

  @Get('history')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Get rider payment history' })
  history(@CurrentUser() user: User, @Query() dto: PaginationDto) {
    return this.paymentsService.getRiderHistory(user.id, dto);
  }

  @Post(':id/refund')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Refund a payment' })
  refund(@Param('id', ParseUUIDPipe) id: string, @Body('reason') reason: string) {
    return this.paymentsService.refund(id, reason);
  }
}
