import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  shortName!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  precision?: number;
}
