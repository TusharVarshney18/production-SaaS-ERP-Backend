import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, IsObject } from 'class-validator';

export class RefundPaymentDto {
  @ApiProperty({ example: 'pay_abc123' })
  @IsString()
  paymentId!: string;

  @ApiPropertyOptional({ example: 2900, description: 'Partial refund amount in cents' })
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({ example: 'Customer requested refund' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
