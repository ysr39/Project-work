import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMobilePhone } from 'class-validator';
import { UserRole } from '../../../common/constants/roles.enum';

export class SendOtpDto {
  @ApiProperty({ example: '+14155552671' })
  @IsMobilePhone()
  phone: string;

  @ApiProperty({ enum: UserRole, example: UserRole.RIDER })
  @IsEnum(UserRole)
  role: UserRole;
}
