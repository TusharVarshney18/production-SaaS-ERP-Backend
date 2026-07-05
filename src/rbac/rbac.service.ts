import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ──────────── Roles ────────────

  async createRole(organizationId: string, dto: CreateRoleDto) {
    const existingSlug = await this.prisma.role.findUnique({
      where: { organizationId_slug: { organizationId, slug: dto.slug } },
      select: { id: true },
    });
    if (existingSlug) {
      throw new ConflictException(
        `Role with slug "${dto.slug}" already exists in this organization`,
      );
    }

    const role = await this.prisma.role.create({
      data: {
        organizationId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description || null,
        isSystem: dto.isSystem || false,
      },
    });

    await this.bumpRoleVersion(organizationId);
    this.logger.log(`Role created: ${role.id} (${role.slug}) in org ${organizationId}`);
    return role;
  }

  async findAllRoles(organizationId: string) {
    return this.prisma.role.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { userRoles: true } },
      },
    });
  }

  async findRoleById(organizationId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId, deletedAt: null },
      include: {
        rolePermissions: {
          include: {
            permission: {
              include: { group: true },
            },
          },
        },
        _count: { select: { userRoles: true } },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async updateRole(organizationId: string, roleId: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId, deletedAt: null },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be modified');
    }

    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });

    await this.bumpRoleVersion(organizationId);
    this.logger.log(`Role updated: ${roleId}`);
    return updated;
  }

  async deleteRole(organizationId: string, roleId: string, userId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId, deletedAt: null },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    await this.prisma.role.update({
      where: { id: roleId },
      data: {
        deletedAt: new Date(),
        deletedByUserId: userId,
      },
    });

    await this.bumpRoleVersion(organizationId);
    this.logger.log(`Role soft-deleted: ${roleId}`);
  }

  async restoreRole(organizationId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId, deletedAt: { not: null } },
    });
    if (!role) {
      throw new NotFoundException('Role not found or not deleted');
    }

    await this.prisma.role.update({
      where: { id: roleId },
      data: { deletedAt: null, deletedByUserId: null },
    });

    await this.bumpRoleVersion(organizationId);
    this.logger.log(`Role restored: ${roleId}`);
  }

  // ──────────── Role Permissions ────────────

  async getRolePermissions(organizationId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId, deletedAt: null },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: {
          include: { group: true },
        },
      },
    });

    return rolePermissions.map((rp) => rp.permission);
  }

  async setRolePermissions(organizationId: string, roleId: string, permissionIds: string[]) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId, deletedAt: null },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isOwner) {
      throw new ForbiddenException('Owner role permissions cannot be modified');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }
    });

    await this.bumpRoleVersion(organizationId);
    this.logger.log(`Role permissions updated: ${roleId} (${permissionIds.length} permissions)`);
  }

  // ──────────── User Role Assignments ────────────

  async assignRole(
    organizationId: string,
    userId: string,
    roleId: string,
    assignedByUserId?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId, deletedAt: null },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (existing) {
      throw new ConflictException('User already has this role');
    }

    await this.prisma.userRole.create({
      data: {
        userId,
        roleId,
        assignedByUserId: assignedByUserId || null,
      },
    });

    await this.bumpRoleVersion(organizationId);
    this.logger.log(`Role ${roleId} assigned to user ${userId}`);
  }

  async removeRole(organizationId: string, userId: string, roleId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId, deletedAt: null },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isOwner) {
      throw new ForbiddenException('Owner role cannot be removed');
    }

    const userRole = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (!userRole) {
      throw new NotFoundException('User does not have this role');
    }

    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });

    await this.bumpRoleVersion(organizationId);
    this.logger.log(`Role ${roleId} removed from user ${userId}`);
  }

  async getUserRoles(organizationId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true,
      },
    });

    return userRoles.map((ur) => ur.role);
  }

  // ──────────── Permissions ────────────

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
      include: { group: true },
    });
  }

  async getPermissionGroups() {
    return this.prisma.permissionGroup.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        permissions: {
          orderBy: { action: 'asc' },
        },
      },
    });
  }

  // ──────────── Helpers ────────────

  private async bumpRoleVersion(organizationId: string) {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { roleVersion: { increment: 1 } },
    });
  }
}
