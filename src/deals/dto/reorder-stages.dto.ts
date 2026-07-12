import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class StageOrder {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsInt()
  displayOrder!: number;
}

export class ReorderStagesDto {
  @ApiProperty({ type: [StageOrder] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageOrder)
  stages!: StageOrder[];
}
