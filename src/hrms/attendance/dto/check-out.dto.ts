import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CheckOutDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  checkOut?: string;
}
