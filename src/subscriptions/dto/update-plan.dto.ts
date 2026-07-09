import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsBoolean, IsInt, Min, IsEnum } from 'class-validator';
import { BillingInterval } from '@prisma/client';

export class UpdatePlanDto {
  @ApiPropertyOptional({ example: 'Growth Plan', description: 'Plan display name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'Perfect for growing teams', description: 'Plan description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ enum: BillingInterval, example: 'MONTHLY' })
  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;

  @ApiPropertyOptional({ example: 2900, description: 'Price in smallest currency unit (cents)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'USD', description: 'Currency code' })
  @IsOptional()
  @IsString()
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
