import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class IncrementUsageDto {
  @ApiProperty({ example: 'import_rows', description: 'Feature slug for the usage counter' })
  @IsString()
  featureSlug!: string;

  @ApiPropertyOptional({ example: 1, description: 'Amount to increment by', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({
    example: '2026-07',
    description: 'Period string (defaults to current YYYY-MM)',
  })
  @IsOptional()
  @IsString()
  period?: string;
}
