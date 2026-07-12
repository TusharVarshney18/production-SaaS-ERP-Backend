import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';

export class ApplyLeaveDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty({ enum: ['CASUAL', 'SICK', 'ANNUAL', 'UNPAID'] })
  @IsEnum(['CASUAL', 'SICK', 'ANNUAL', 'UNPAID'])
  leaveType!: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
