import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, Min, IsEnum, IsOptional, IsObject } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ example: 'org-uuid' })
  @IsString()
  organizationId!: string;

  @ApiPropertyOptional({ example: 'sub-uuid' })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiPropertyOptional({ example: 'inv-uuid' })
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiProperty({ example: 2900 })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'razorpay' })
  @IsString()
  provider!: string;

  @ApiPropertyOptional({ example: 'pay_abc123' })
  @IsOptional()
  @IsString()
  providerPaymentId?: string;

  @ApiPropertyOptional({ example: 'order_abc123' })
  @IsOptional()
  @IsString()
  providerOrderId?: string;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
