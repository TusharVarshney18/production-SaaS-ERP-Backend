import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RbacService } from './rbac.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { PermissionGuard } from '../authorization/guards/permission.guard';

@ApiTags('RBAC')
@Controller('rbac')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  // ──────────── Roles ────────────

  @Get('roles')
  @ApiOperation({ summary: 'List all roles in the organization' })
  async findAllRoles(@CurrentUser() user: JwtPayload) {
    return this.rbacService.findAllRoles(user.org);
  }

  @Post('roles')
  @UseGuards(PermissionGuard)
  @Permissions('role:create')
  @ApiOperation({ summary: 'Create a new role' })
  async createRole(@CurrentUser() user: JwtPayload, @Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(user.org, dto);
  }

  @Get('roles/:id')
  @ApiOperation({ summary: 'Get role details with permissions' })
  async findRole(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.rbacService.findRoleById(user.org, id);
  }

  @Patch('roles/:id')
  @UseGuards(PermissionGuard)
  @Permissions('role:update')
  @ApiOperation({ summary: 'Update role' })
  async updateRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbacService.updateRole(user.org, id, dto);
  }

  @Delete('roles/:id')
  @UseGuards(PermissionGuard)
  @Permissions('role:delete')
  @ApiOperation({ summary: 'Soft delete role' })
  async deleteRole(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.rbacService.deleteRole(user.org, id, user.sub);
    return { message: 'Role deleted successfully' };
  }

  @Patch('roles/:id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('role:update')
  @ApiOperation({ summary: 'Restore soft-deleted role' })
  async restoreRole(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.rbacService.restoreRole(user.org, id);
    return { message: 'Role restored successfully' };
  }

  // ──────────── Role Permissions ────────────

  @Get('roles/:id/permissions')
  @ApiOperation({ summary: 'Get permissions assigned to role' })
  async getRolePermissions(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.rbacService.getRolePermissions(user.org, id);
  }

  @Put('roles/:id/permissions')
  @UseGuards(PermissionGuard)
  @Permissions('role:update')
  @ApiOperation({ summary: 'Set permissions for a role' })
  async setRolePermissions(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('permissionIds') permissionIds: string[],
  ) {
    await this.rbacService.setRolePermissions(user.org, id, permissionIds);
    return { message: 'Role permissions updated successfully' };
  }

  // ──────────── User Role Assignments ────────────

  @Post('users/:userId/roles')
  @UseGuards(PermissionGuard)
  @Permissions('user:update')
  @ApiOperation({ summary: 'Assign role to user' })
  async assignRole(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    await this.rbacService.assignRole(user.org, userId, dto.roleId, user.sub);
    return { message: 'Role assigned successfully' };
  }

  @Delete('users/:userId/roles/:roleId')
  @UseGuards(PermissionGuard)
  @Permissions('user:update')
  @ApiOperation({ summary: 'Remove role from user' })
  async removeRole(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    await this.rbacService.removeRole(user.org, userId, roleId);
    return { message: 'Role removed successfully' };
  }

  @Get('users/:userId/roles')
  @ApiOperation({ summary: 'Get all roles for a user' })
  async getUserRoles(@CurrentUser() user: JwtPayload, @Param('userId') userId: string) {
    return this.rbacService.getUserRoles(user.org, userId);
  }

  // ──────────── Permissions ────────────

  @Get('permissions')
  @ApiOperation({ summary: 'List all available permissions' })
  async getAllPermissions() {
    return this.rbacService.getAllPermissions();
  }

  @Get('permission-groups')
  @ApiOperation({ summary: 'List all permission groups with their permissions' })
  async getPermissionGroups() {
    return this.rbacService.getPermissionGroups();
  }
}
