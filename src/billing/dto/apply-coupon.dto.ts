import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class ApplyCouponDto {
  @ApiProperty({ example: 'SUMMER2026' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 'org-uuid' })
  @IsString()
  organizationId!: string;

  @ApiPropertyOptional({ example: 2900, description: 'Order amount in cents' })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderAmount?: number;

  @ApiPropertyOptional({ example: 'plan-uuid', description: 'Plan ID for plan-specific coupons' })
  @IsOptional()
  @IsString()
  planId?: string;
}
