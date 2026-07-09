import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, Min, IsEnum, IsOptional, IsObject } from 'class-validator';
import { PaymentCurrency } from '../interfaces/payment.types';

export class CreateCheckoutDto {
  @ApiProperty({ example: 2900, description: 'Amount in smallest currency unit (cents)' })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ enum: ['INR', 'USD', 'EUR', 'GBP'], example: 'USD' })
  @IsEnum(['INR', 'USD', 'EUR', 'GBP'] as const)
  currency!: PaymentCurrency;

  @ApiProperty({ example: 'org-uuid' })
  @IsString()
  organizationId!: string;

  @ApiProperty({ example: 'sub-uuid' })
  @IsString()
  subscriptionId!: string;

  @ApiProperty({ example: 'plan-uuid' })
  @IsString()
  planId!: string;

  @ApiPropertyOptional({ example: 'Growth Plan - Monthly' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: { order_id: 'ORD-123' } })
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
