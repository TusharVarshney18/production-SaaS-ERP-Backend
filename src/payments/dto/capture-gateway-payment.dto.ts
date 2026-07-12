import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsUUID, IsEnum, Min } from 'class-validator';
import { PaymentGatewayType } from '@prisma/client';

export class CaptureGatewayPaymentDto {
  @ApiProperty()
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({ enum: PaymentGatewayType })
  @IsEnum(PaymentGatewayType)
  gateway!: PaymentGatewayType;

  @ApiProperty()
  @IsString()
  transactionId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
