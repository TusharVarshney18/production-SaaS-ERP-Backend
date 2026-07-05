import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    description: 'Refresh token issued at login or previous refresh',
  })
  @IsString()
  refreshToken!: string;
}
