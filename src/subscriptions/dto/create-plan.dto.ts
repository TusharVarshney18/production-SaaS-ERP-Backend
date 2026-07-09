import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { BillingInterval } from '@prisma/client';

export class CreatePlanDto {
  @ApiProperty({ example: 'Growth Plan', description: 'Plan display name' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'growth', description: 'URL-friendly slug' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must be lowercase alphanumeric with hyphens only',
  })
  slug!: string;

  @ApiPropertyOptional({ example: 'Perfect for growing teams', description: 'Plan description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: BillingInterval, example: 'MONTHLY' })
  @IsEnum(BillingInterval)
  billingInterval!: BillingInterval;

  @ApiProperty({ example: 2900, description: 'Price in smallest currency unit (cents)' })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 'USD', description: 'Currency code' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  @ApiPropertyOptional({ example: 14, description: 'Trial period in days' })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialPeriodDays?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
