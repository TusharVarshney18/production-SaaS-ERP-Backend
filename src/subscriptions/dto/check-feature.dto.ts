import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CheckFeatureDto {
  @ApiProperty({ example: 'ai_import_enabled', description: 'Feature slug to check' })
  @IsString()
  featureSlug!: string;
}
