import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class PreviewDiscountDto {
  @ApiProperty({ description: 'Coupon code' })
  @IsString()
  code!: string;

  @ApiPropertyOptional({ description: 'Order amount in cents' })
  @IsOptional()
  @IsInt()
  @Min(1)
  orderAmount?: number;

  @ApiPropertyOptional({ description: 'Target plan ID' })
  @IsOptional()
  @IsString()
  planId?: string;
}
