import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class ChangePriorityDto {
  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority!: string;
}
