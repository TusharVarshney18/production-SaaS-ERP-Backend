import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateLeadNoteDto {
  @ApiProperty()
  @IsString()
  content!: string;
}
