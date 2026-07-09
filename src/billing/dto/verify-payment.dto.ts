import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { PaymentProviderName } from '../interfaces/payment.types';

export class VerifyPaymentDto {
  @ApiProperty({ example: 'session_abc123' })
  @IsString()
  sessionId!: string;

  @ApiPropertyOptional({ example: 'pay_abc123' })
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiProperty({ enum: ['razorpay', 'stripe', 'paypal', 'phonepe', 'cashfree', 'payu', 'paddle'] })
  @IsEnum(['razorpay', 'stripe', 'paypal', 'phonepe', 'cashfree', 'payu', 'paddle'] as const)
  provider!: PaymentProviderName;

  @ApiPropertyOptional({ example: 'signature_xyz' })
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
