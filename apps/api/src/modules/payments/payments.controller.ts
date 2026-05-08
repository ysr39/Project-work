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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { PaymentsService }         from './payments.service';
import { PayoutService }           from './payout.service';
import { WalletService }           from './wallet.service';
import { CreatePaymentIntentDto }  from './dto/create-payment-intent.dto';
import { WalletTopupDto }          from './dto/wallet-topup.dto';
import { RefundDto }               from './dto/refund.dto';
import { ManualPayoutDto }         from './dto/manual-payout.dto';
import { CurrentUser }             from '../../common/decorators/current-user.decorator';
import { Public }                  from '../../common/decorators/public.decorator';
import { Roles }                   from '../../common/decorators/roles.decorator';
import { UserRole }                from '../../common/constants/roles.enum';
import { PaginationDto }           from '../../common/dto/pagination.dto';
import { PaymentStatus, PayoutStatus } from '../../common/constants/trip-status.enum';
import { User }                    from '../users/entities/user.entity';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly payoutService:   PayoutService,
    private readonly walletService:   WalletService,
  ) {}

  /* ─── Ride payment ───────────────────────────────────────────────────── */

  @Post('intent')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Create Stripe PaymentIntent for a ride (authorize-only)' })
  createIntent(@CurrentUser() user: User, @Body() dto: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(user.id, dto);
  }

  @Get('history')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Get rider payment history' })
  history(@CurrentUser() user: User, @Query() dto: PaginationDto) {
    return this.paymentsService.getRiderHistory(user.id, dto);
  }

  /* ─── Stripe webhook ─────────────────────────────────────────────────── */

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Stripe webhook receiver (Stripe → server)' })
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentsService.handleWebhook(req.rawBody!, signature);
  }

  /* ─── Admin: payments ────────────────────────────────────────────────── */

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] List all payments with optional status filter' })
  @ApiQuery({ name: 'status', enum: PaymentStatus, required: false })
  adminPayments(@Query() dto: PaginationDto & { status?: PaymentStatus }) {
    return this.paymentsService.getAllPayments(dto);
  }

  @Post('admin/:id/refund')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Refund a captured payment (full or partial)' })
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundDto,
  ) {
    return this.paymentsService.refund(id, { amountRupees: dto.amountRupees, reason: dto.reason });
  }

  /* ─── Wallet ─────────────────────────────────────────────────────────── */

  @Get('wallet/balance')
  @ApiOperation({ summary: 'Get current wallet balance' })
  walletBalance(@CurrentUser() user: User) {
    return this.walletService.getBalance(user.id);
  }

  @Post('wallet/topup')
  @ApiOperation({ summary: 'Initiate wallet top-up via Stripe' })
  walletTopup(@CurrentUser() user: User, @Body() dto: WalletTopupDto) {
    return this.walletService.initiateTopup(user.id, dto.amountRupees);
  }

  @Get('wallet/transactions')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  walletTransactions(@CurrentUser() user: User, @Query() dto: PaginationDto) {
    return this.walletService.getTransactions(user.id, dto);
  }

  /* ─── Driver Connect onboarding ──────────────────────────────────────── */

  @Post('connect/onboard')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Initiate Stripe Connect Express onboarding for driver' })
  onboard(
    @CurrentUser() user: User,
    @Body('baseUrl') baseUrl: string,
  ) {
    return this.payoutService.initiateOnboarding(user.id, baseUrl);
  }

  @Get('connect/status')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Get driver Stripe Connect account status' })
  onboardStatus(@CurrentUser() user: User) {
    return this.payoutService.getOnboardingStatus(user.id);
  }

  /* ─── Driver payouts ─────────────────────────────────────────────────── */

  @Get('payouts/mine')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver: get own payout history' })
  myPayouts(@CurrentUser() user: User, @Query() dto: PaginationDto) {
    return this.payoutService.getDriverPayoutHistory(user.id, dto);
  }

  @Get('payouts/mine/summary')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver: get earnings summary + commission tier' })
  myPayoutSummary(@CurrentUser() user: User) {
    return this.payoutService.getPayoutSummary(user.id);
  }

  /* ─── Admin: payouts ─────────────────────────────────────────────────── */

  @Get('admin/payouts')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] List all driver payouts' })
  @ApiQuery({ name: 'status', enum: PayoutStatus, required: false })
  adminPayouts(@Query() dto: PaginationDto & { status?: PayoutStatus }) {
    return this.payoutService.getAllPayouts(dto);
  }

  @Post('admin/payouts/driver/:driverId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Manually trigger a driver payout for a date range' })
  manualPayout(
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Body() dto: ManualPayoutDto,
  ) {
    return this.payoutService.triggerManualPayout(driverId, {
      periodStart: new Date(dto.periodStart),
      periodEnd:   new Date(dto.periodEnd),
    });
  }

  @Post('admin/payouts/retry-failed')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Retry all failed driver payouts' })
  retryFailed() {
    return this.payoutService.retryFailedPayouts();
  }

  @Get('admin/payouts/driver/:driverId/summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Get earnings summary for a specific driver' })
  driverSummary(@Param('driverId', ParseUUIDPipe) driverId: string) {
    return this.payoutService.getPayoutSummary(driverId);
  }
}
