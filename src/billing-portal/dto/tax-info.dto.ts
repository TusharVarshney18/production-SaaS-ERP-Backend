import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TaxInfoDto {
  @ApiPropertyOptional({ description: 'Tax ID / VAT number' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ enum: ['GST', 'VAT', 'SALES_TAX', 'NONE'] })
  @IsOptional()
  @IsString()
  taxType?: string;

  @ApiPropertyOptional({ description: 'Registered business name' })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional({ description: 'Business address' })
  @IsOptional()
  @IsString()
  address?: string;
}
