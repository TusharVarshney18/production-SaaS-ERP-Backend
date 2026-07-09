import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsObject, IsEnum } from 'class-validator';
import { PaymentProviderName } from '../interfaces/payment.types';

export class CancelBillingSubscriptionDto {
  @ApiProperty({ example: 'sub_provider_abc123' })
  @IsString()
  providerSubscriptionId!: string;

  @ApiProperty({ enum: ['razorpay', 'stripe', 'paypal', 'phonepe', 'cashfree', 'payu', 'paddle'] })
  @IsEnum(['razorpay', 'stripe', 'paypal', 'phonepe', 'cashfree', 'payu', 'paddle'] as const)
  provider!: PaymentProviderName;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  atPeriodEnd?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
