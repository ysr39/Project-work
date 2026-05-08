import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DriversService } from './drivers.service';
import { OnboardDriverDto } from './dto/onboard-driver.dto';
import { ToggleOnlineDto } from './dto/toggle-online.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Drivers')
@ApiBearerAuth()
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post('onboard')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Submit driver onboarding details' })
  onboard(@CurrentUser() user: User, @Body() dto: OnboardDriverDto) {
    return this.driversService.onboard(user.id, dto);
  }

  @Get('me')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Get driver profile with vehicles and documents' })
  getMyProfile(@CurrentUser() user: User) {
    return this.driversService.getFullProfile(user.id);
  }

  @Patch('me/status')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Toggle driver online/offline status' })
  toggleOnline(@CurrentUser() user: User, @Body() dto: ToggleOnlineDto) {
    return this.driversService.toggleOnline(user.id, dto);
  }
}
