import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class MarkWonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wonReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualCloseDate?: string;
}
