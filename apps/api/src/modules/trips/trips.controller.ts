import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { User } from '../users/entities/user.entity';

@ApiTags('Trips')
@ApiBearerAuth()
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('estimate')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Get fare estimate before booking' })
  estimate(@Body() dto: CreateTripDto) {
    return this.tripsService.estimateFare(dto);
  }

  @Post()
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Create a new trip request' })
  create(@CurrentUser() user: User, @Body() dto: CreateTripDto) {
    return this.tripsService.create(user.id, dto);
  }

  @Get('history')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Get rider trip history' })
  riderHistory(@CurrentUser() user: User, @Query() dto: PaginationDto) {
    return this.tripsService.getRiderHistory(user.id, dto);
  }

  @Get('driver/history')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Get driver trip history' })
  driverHistory(@CurrentUser() user: User, @Query() dto: PaginationDto) {
    return this.tripsService.getDriverHistory(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get trip details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tripsService.findById(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.DRIVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update trip status (driver/admin)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateTripStatusDto,
  ) {
    return this.tripsService.updateStatus(id, user.id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Cancel trip (rider)' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('reason') reason: string,
  ) {
    return this.tripsService.cancel(id, user.id, reason);
  }
}
