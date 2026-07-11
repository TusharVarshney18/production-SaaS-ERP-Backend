import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DowngradePlanDto {
  @ApiProperty({ description: 'Target plan ID' })
  @IsString()
  planId!: string;
}
