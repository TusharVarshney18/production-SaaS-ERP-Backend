import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { RbacService } from '../rbac.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';

describe('RbacService', () => {
  let service: RbacService;
  let prisma: DeepMockProxy<PrismaService>;

  const orgId = 'org-1';
  const userId = 'user-1';

  const mockRole = {
    id: 'role-1',
    organizationId: orgId,
    name: 'Editor',
    slug: 'editor',
    description: 'Can edit',
    isSystem: false,
    isOwner: false,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    deletedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPermission = {
    id: 'perm-1',
    groupId: 'group-1',
    resource: 'invoice',
    action: 'create',
    description: null,
    createdAt: new Date(),
    group: {
      id: 'group-1',
      name: 'Sales',
      slug: 'sales',
      description: null,
      displayOrder: 1,
      deletedAt: null,
      deletedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    service = new RbacService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRole', () => {
    const dto: CreateRoleDto = { name: 'Editor', slug: 'editor' };

    it('should create a role', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.role.create as jest.Mock).mockResolvedValue(mockRole);
      (prisma.organization.update as jest.Mock).mockResolvedValue(undefined);

      const result = await service.createRole(orgId, dto);

      expect(prisma.role.findUnique).toHaveBeenCalledWith({
        where: { organizationId_slug: { organizationId: orgId, slug: 'editor' } },
        select: { id: true },
      });
      expect(prisma.role.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          name: 'Editor',
          slug: 'editor',
          description: null,
          isSystem: false,
        },
      });
      expect(result).toEqual(mockRole);
    });

    it('should throw ConflictException if slug exists', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(service.createRole(orgId, dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllRoles', () => {
    it('should return all roles for org', async () => {
      const roles = [{ ...mockRole, _count: { userRoles: 2 } }];
      (prisma.role.findMany as jest.Mock).mockResolvedValue(roles);

      const result = await service.findAllRoles(orgId);

      expect(prisma.role.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { userRoles: true } } },
      });
      expect(result).toEqual(roles);
    });
  });

  describe('findRoleById', () => {
    it('should return role with permissions', async () => {
      const roleWithPermissions = {
        ...mockRole,
        rolePermissions: [{ permission: mockPermission }],
        _count: { userRoles: 1 },
      };
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(roleWithPermissions);

      const result = await service.findRoleById(orgId, 'role-1');

      expect(result).toEqual(roleWithPermissions);
    });

    it('should throw NotFoundException', async () => {
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findRoleById(orgId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRole', () => {
    const dto: UpdateRoleDto = { name: 'Senior Editor' };

    it('should update role', async () => {
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(mockRole);
      (prisma.role.update as jest.Mock).mockResolvedValue({ ...mockRole, name: 'Senior Editor' });
      (prisma.organization.update as jest.Mock).mockResolvedValue(undefined);

      const result = await service.updateRole(orgId, 'role-1', dto);

      expect(result.name).toBe('Senior Editor');
    });

    it('should throw ForbiddenException for system roles', async () => {
      (prisma.role.findFirst as jest.Mock).mockResolvedValue({ ...mockRole, isSystem: true });

      await expect(service.updateRole(orgId, 'role-1', dto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException', async () => {
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.updateRole(orgId, 'nonexistent', dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteRole', () => {
    it('should soft delete role', async () => {
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(mockRole);
      (prisma.organization.update as jest.Mock).mockResolvedValue(undefined);

      await service.deleteRole(orgId, 'role-1', userId);

      expect(prisma.role.update).toHaveBeenCalledWith({
        where: { id: 'role-1' },
        data: { deletedAt: expect.any(Date), deletedByUserId: userId },
      });
    });

    it('should throw ForbiddenException for system roles', async () => {
      (prisma.role.findFirst as jest.Mock).mockResolvedValue({ ...mockRole, isSystem: true });

      await expect(service.deleteRole(orgId, 'role-1', userId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('restoreRole', () => {
    it('should restore deleted role', async () => {
      (prisma.role.findFirst as jest.Mock).mockResolvedValue({
        ...mockRole,
        deletedAt: new Date(),
      });
      (prisma.organization.update as jest.Mock).mockResolvedValue(undefined);

      await service.restoreRole(orgId, 'role-1');

      expect(prisma.role.update).toHaveBeenCalledWith({
        where: { id: 'role-1' },
        data: { deletedAt: null, deletedByUserId: null },
      });
    });
  });

  describe('getRolePermissions', () => {
    it('should return permissions for role', async () => {
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(mockRole);
      (prisma.rolePermission.findMany as jest.Mock).mockResolvedValue([
        { permission: mockPermission },
      ]);

      const result = await service.getRolePermissions(orgId, 'role-1');

      expect(result).toEqual([mockPermission]);
    });
  });

  describe('setRolePermissions', () => {
    it('should replace permissions for a role', async () => {
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(mockRole);
      prisma.$transaction.mockImplementation(async (cb: unknown) =>
        (cb as (tx: typeof prisma) => Promise<unknown>)(prisma),
      );
      (prisma.organization.update as jest.Mock).mockResolvedValue(undefined);

      await service.setRolePermissions(orgId, 'role-1', ['perm-1', 'perm-2']);

      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId: 'role-1' },
      });
      expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: [
          { roleId: 'role-1', permissionId: 'perm-1' },
          { roleId: 'role-1', permissionId: 'perm-2' },
        ],
      });
    });

    it('should throw ForbiddenException for owner role', async () => {
      (prisma.role.findFirst as jest.Mock).mockResolvedValue({ ...mockRole, isOwner: true });

      await expect(service.setRolePermissions(orgId, 'role-1', [])).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assignRole', () => {
    it('should assign role to user', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user-1' });
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(mockRole);
      (prisma.userRole.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.organization.update as jest.Mock).mockResolvedValue(undefined);

      await service.assignRole(orgId, 'user-1', 'role-1', 'admin-1');

      expect(prisma.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', roleId: 'role-1', assignedByUserId: 'admin-1' },
      });
    });

    it('should throw ConflictException if already assigned', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user-1' });
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(mockRole);
      (prisma.userRole.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(service.assignRole(orgId, 'user-1', 'role-1', 'admin-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('removeRole', () => {
    it('should remove role from user', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user-1' });
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(mockRole);
      (prisma.userRole.findUnique as jest.Mock).mockResolvedValue({ id: 'ur-1' });
      (prisma.organization.update as jest.Mock).mockResolvedValue(undefined);

      await service.removeRole(orgId, 'user-1', 'role-1');

      expect(prisma.userRole.delete).toHaveBeenCalledWith({
        where: { userId_roleId: { userId: 'user-1', roleId: 'role-1' } },
      });
    });

    it('should throw ForbiddenException for owner role', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user-1' });
      (prisma.role.findFirst as jest.Mock).mockResolvedValue({ ...mockRole, isOwner: true });

      await expect(service.removeRole(orgId, 'user-1', 'role-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getUserRoles', () => {
    it('should return roles for user', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user-1' });
      (prisma.userRole.findMany as jest.Mock).mockResolvedValue([{ role: mockRole }]);

      const result = await service.getUserRoles(orgId, 'user-1');

      expect(result).toEqual([mockRole]);
    });

    it('should throw if user not found', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getUserRoles(orgId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllPermissions', () => {
    it('should return all permissions', async () => {
      (prisma.permission.findMany as jest.Mock).mockResolvedValue([mockPermission]);

      const result = await service.getAllPermissions();

      expect(result).toEqual([mockPermission]);
    });
  });

  describe('getPermissionGroups', () => {
    it('should return groups with permissions', async () => {
      const groups = [
        {
          id: 'group-1',
          name: 'Sales',
          slug: 'sales',
          description: null,
          displayOrder: 1,
          deletedAt: null,
          deletedByUserId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          permissions: [mockPermission],
        },
      ];
      (prisma.permissionGroup.findMany as jest.Mock).mockResolvedValue(groups);

      const result = await service.getPermissionGroups();

      expect(result).toEqual(groups);
    });
  });
});
