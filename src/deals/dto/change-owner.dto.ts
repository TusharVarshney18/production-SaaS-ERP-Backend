import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ChangeOwnerDto {
  @ApiProperty()
  @IsString()
  ownerId!: string;
}
