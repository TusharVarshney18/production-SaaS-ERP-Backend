import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'plan-uuid', description: 'Plan ID to subscribe to' })
  @IsString()
  planId!: string;

  @ApiProperty({ example: 14, description: 'Trial period in days (0 for no trial)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialPeriodDays?: number;
}
