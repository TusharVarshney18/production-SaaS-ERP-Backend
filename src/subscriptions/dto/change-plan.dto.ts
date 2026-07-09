import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class ChangePlanDto {
  @ApiProperty({ example: 'new-plan-uuid', description: 'Target plan ID' })
  @IsString()
  planId!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Apply immediately instead of period end (upgrade only)',
  })
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;
}
