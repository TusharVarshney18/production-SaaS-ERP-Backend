import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class MarkLostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lossReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualCloseDate?: string;
}
