import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ItemOrder {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  displayOrder!: number;
}

export class ReorderItemsDto {
  @ApiProperty({ type: [ItemOrder] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemOrder)
  items!: ItemOrder[];
}
