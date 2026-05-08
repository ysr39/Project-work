import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleOnlineDto {
  @ApiProperty()
  @IsBoolean()
  isOnline: boolean;
}
