import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class ChangeDueDateDto {
  @ApiProperty()
  @IsDateString()
  dueDate!: string;
}
