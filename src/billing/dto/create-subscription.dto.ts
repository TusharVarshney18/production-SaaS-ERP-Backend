import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, Min, IsEnum, IsOptional, IsObject } from 'class-validator';
import { PaymentCurrency } from '../interfaces/payment.types';

export class CreateBillingSubscriptionDto {
  @ApiProperty({ example: 'org-uuid' })
  @IsString()
  organizationId!: string;

  @ApiProperty({ example: 'plan-uuid' })
  @IsString()
  planId!: string;

  @ApiProperty({ example: 'Growth Plan' })
  @IsString()
  planName!: string;

  @ApiProperty({ example: 2900 })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ enum: ['INR', 'USD', 'EUR', 'GBP'], example: 'USD' })
  @IsEnum(['INR', 'USD', 'EUR', 'GBP'] as const)
  currency!: PaymentCurrency;

  @ApiProperty({ enum: ['monthly', 'yearly'] })
  @IsEnum(['monthly', 'yearly'] as const)
  interval!: 'monthly' | 'yearly';

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialPeriodDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  @ApiProperty({ example: 'https://app.erpx.io/billing/success' })
  @IsString()
  successUrl!: string;

  @ApiProperty({ example: 'https://app.erpx.io/billing/cancel' })
  @IsString()
  cancelUrl!: string;
}
