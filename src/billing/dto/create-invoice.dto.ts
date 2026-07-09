import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, Min, IsOptional, IsObject, IsDateString } from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty({ example: 'org-uuid' })
  @IsString()
  organizationId!: string;

  @ApiPropertyOptional({ example: 'sub-uuid' })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiProperty({ example: 2900 })
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional({ example: 'inv-addr-uuid' })
  @IsOptional()
  @IsString()
  billingAddressId?: string;

  @ApiPropertyOptional({ example: 'Payment for Growth Plan - July 2026' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
