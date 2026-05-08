import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PoolingService } from './pooling.service';
import { PoolRequestDto, FareEstimateDto } from './dto/pool-request.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.enum';
import { User } from '../users/entities/user.entity';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Pooling')
@ApiBearerAuth()
@Controller('pooling')
export class PoolingController {
  constructor(private readonly poolingService: PoolingService) {}

  @Post('request')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Request a pool or solo ride — runs matching pipeline' })
  requestRide(@CurrentUser() user: User, @Body() dto: PoolRequestDto) {
    return this.poolingService.requestRide(user.id, dto);
  }

  @Post('estimate')
  @Public()
  @ApiOperation({ summary: 'Get fare estimate (no booking)' })
  estimate(@Body() dto: FareEstimateDto) {
    return this.poolingService.estimateFare(dto);
  }

  @Get(':tripId')
  @ApiOperation({ summary: 'Get pool trip details with stops and financials' })
  getDetails(@Param('tripId', ParseUUIDPipe) tripId: string) {
    return this.poolingService.getPoolDetails(tripId);
  }

  @Get(':tripId/eligibility')
  @ApiOperation({ summary: 'Check if new rider can join an existing pool' })
  checkEligibility(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Query('seats') seats: string,
  ) {
    return this.poolingService.checkJoinEligibility(tripId, parseInt(seats) || 1);
  }

  @Delete(':tripId/cancel')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Cancel ride — applies cancellation policy' })
  cancelRide(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @CurrentUser() user: User,
    @Body('reason') reason: string,
  ) {
    return this.poolingService.cancelRide(tripId, user.id, reason);
  }

  @Delete(':tripId/driver-cancel')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver cancels assigned trip — riders get full refund' })
  driverCancel(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @CurrentUser() user: User,
    @Body('reason') reason: string,
  ) {
    return this.poolingService.cancelByDriver(tripId, user.id, reason);
  }
}
