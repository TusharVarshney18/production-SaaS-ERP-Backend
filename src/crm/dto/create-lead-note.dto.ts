import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateLeadNoteDto {
  @ApiProperty()
  @IsString()
  content!: string;
}
