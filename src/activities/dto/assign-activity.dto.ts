import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignActivityDto {
  @ApiProperty()
  @IsString()
  assignedToId!: string;
}
