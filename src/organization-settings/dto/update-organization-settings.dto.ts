import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateOrganizationSettingsDto {
  @ApiPropertyOptional({ example: 'America/New_York', description: 'Timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'EUR', description: 'Currency code' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  @ApiPropertyOptional({ example: 'DD/MM/YYYY', description: 'Date format' })
  @IsOptional()
  @IsString()
  dateFormat?: string;

  @ApiPropertyOptional({ example: '07-01', description: 'Fiscal year start (MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}-\d{2}$/, { message: 'fiscalYearStart must be in MM-DD format' })
  fiscalYearStart?: string;
}
