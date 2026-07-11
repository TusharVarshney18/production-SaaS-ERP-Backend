import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class ChangeOrgPlanDto {
  @ApiProperty({ enum: ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'] })
  @IsEnum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE'])
  plan!: string;
}
