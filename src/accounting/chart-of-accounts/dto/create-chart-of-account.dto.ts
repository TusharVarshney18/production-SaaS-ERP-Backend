import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export class CreateChartOfAccountDto {
  @ApiProperty()
  @IsString()
  accountCode!: string;

  @ApiProperty()
  @IsString()
  accountName!: string;

  @ApiProperty({ enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] })
  @IsEnum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
  accountType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentAccountId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
