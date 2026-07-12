import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CheckInDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  checkIn?: string;
}
