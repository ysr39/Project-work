import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMobilePhone, IsString, Length } from 'class-validator';
import { UserRole } from '../../../common/constants/roles.enum';

export class VerifyOtpDto {
  @ApiProperty({ example: '+14155552671' })
  @IsMobilePhone()
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  otp: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}
