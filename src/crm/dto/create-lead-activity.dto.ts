import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';

export class CreateLeadActivityDto {
  @ApiProperty({ enum: ['CALL', 'MEETING', 'TASK', 'EMAIL', 'REMINDER'] })
  @IsEnum(['CALL', 'MEETING', 'TASK', 'EMAIL', 'REMINDER'])
  type!: string;

  @ApiProperty()
  @IsString()
  subject!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
