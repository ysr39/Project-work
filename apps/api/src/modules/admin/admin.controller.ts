import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminService } from './admin.service';
import { RejectDriverDto } from './dto/approve-driver.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { User } from '../users/entities/user.entity';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'KPI dashboard metrics' })
  dashboard() {
    return this.adminService.getDashboardKpis();
  }

  @Get('trips')
  @ApiOperation({ summary: 'List all trips' })
  trips(@Query() dto: PaginationDto) {
    return this.adminService.getAllTrips(dto);
  }

  @Get('drivers/pending')
  @ApiOperation({ summary: 'List drivers pending approval' })
  pendingDrivers(@Query() dto: PaginationDto) {
    return this.adminService.getPendingDrivers(dto);
  }

  @Patch('drivers/:id/approve')
  @ApiOperation({ summary: 'Approve driver application' })
  approveDriver(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: User) {
    return this.adminService.approveDriver(id, admin.id);
  }

  @Patch('drivers/:id/reject')
  @ApiOperation({ summary: 'Reject driver application' })
  rejectDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: User,
    @Body() dto: RejectDriverDto,
  ) {
    return this.adminService.rejectDriver(id, admin.id, dto.reason);
  }

  @Patch('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend a user' })
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.suspendUser(id);
  }

  @Patch('users/:id/ban')
  @ApiOperation({ summary: 'Ban a user permanently' })
  ban(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.banUser(id);
  }

  @Patch('users/:id/reinstate')
  @ApiOperation({ summary: 'Reinstate a suspended/banned user' })
  reinstate(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.reinstateUser(id);
  }

  @Get('reports/revenue')
  @ApiOperation({ summary: 'Revenue report by date range' })
  revenue(@Query('from') from: string, @Query('to') to: string) {
    return this.adminService.getRevenueReport(new Date(from), new Date(to));
  }
}
