import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DuplicatePlanDto {
  @ApiPropertyOptional({ description: 'Name for the duplicated plan' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Slug for the duplicated plan' })
  @IsOptional()
  @IsString()
  slug?: string;
}
