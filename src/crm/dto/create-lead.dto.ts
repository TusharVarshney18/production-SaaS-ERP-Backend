import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
  IsArray,
} from 'class-validator';

export class CreateLeadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty()
  @IsString()
  contactName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({
    enum: [
      'NEW',
      'CONTACTED',
      'QUALIFIED',
      'PROPOSAL',
      'NEGOTIATION',
      'WON',
      'LOST',
      'DISQUALIFIED',
    ],
    default: 'NEW',
  })
  @IsOptional()
  @IsEnum([
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'PROPOSAL',
    'NEGOTIATION',
    'WON',
    'LOST',
    'DISQUALIFIED',
  ])
  status?: string;

  @ApiPropertyOptional({
    enum: [
      'WEBSITE',
      'REFERRAL',
      'SOCIAL_MEDIA',
      'EMAIL',
      'PHONE',
      'ADVERTISEMENT',
      'PARTNER',
      'EVENT',
      'OTHER',
    ],
    default: 'OTHER',
  })
  @IsOptional()
  @IsEnum([
    'WEBSITE',
    'REFERRAL',
    'SOCIAL_MEDIA',
    'EMAIL',
    'PHONE',
    'ADVERTISEMENT',
    'PARTNER',
    'EVENT',
    'OTHER',
  ])
  source?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
