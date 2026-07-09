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
  IsArray,
  IsDateString,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreateCouponDto {
  @ApiProperty({ example: 'SUMMER2026', description: 'Coupon code (uppercase alphanumeric)' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code must be uppercase alphanumeric with underscores and hyphens only',
  })
  code!: string;

  @ApiProperty({ example: 'Summer Sale 2026', description: 'Coupon display name' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: '20% off all plans' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: DiscountType, example: 'PERCENTAGE' })
  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @ApiProperty({ example: 20, description: 'Discount value (percentage or fixed amount in cents)' })
  @IsInt()
  @Min(1)
  discountValue!: number;

  @ApiPropertyOptional({ example: 1000, description: 'Maximum number of uses (null = unlimited)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional({ example: 1, description: 'Max uses per customer (null = unlimited)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPerCustomer?: number;

  @ApiPropertyOptional({ example: 'USD', description: 'Restrict to specific currency' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 1000, description: 'Minimum order amount in cents' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Plan IDs this coupon applies to (all if empty)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  appliesToPlanIds?: string[];

  @ApiPropertyOptional({ description: 'Start date (ISO string)' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'Expiry date (ISO string)' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
