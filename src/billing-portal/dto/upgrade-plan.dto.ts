import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpgradePlanDto {
  @ApiProperty({ description: 'Target plan ID' })
  @IsString()
  planId!: string;

  @ApiPropertyOptional({ description: 'Immediately apply the change' })
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;
}
