import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsEnum } from 'class-validator';
import { PaymentProviderName } from '../interfaces/payment.types';

export class HandleWebhookDto {
  @ApiProperty({ enum: ['razorpay', 'stripe', 'paypal', 'phonepe', 'cashfree', 'payu', 'paddle'] })
  @IsEnum(['razorpay', 'stripe', 'paypal', 'phonepe', 'cashfree', 'payu', 'paddle'] as const)
  provider!: PaymentProviderName;

  @ApiProperty()
  @IsObject()
  rawBody!: unknown;

  @ApiProperty({ example: { 'x-webhook-signature': 'sig_abc' } })
  @IsObject()
  headers!: Record<string, string>;

  @ApiProperty({ example: 'whsec_abc123' })
  @IsString()
  signature!: string;
}
