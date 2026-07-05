import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ example: 'role-uuid', description: 'Role ID to assign' })
  @IsString()
  roleId!: string;
}
