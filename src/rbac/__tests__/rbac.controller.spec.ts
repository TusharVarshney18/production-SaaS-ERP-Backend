import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RbacController } from '../rbac.controller';
import { RbacService } from '../rbac.service';
import { AuthorizationService } from '../../authorization/authorization.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

describe('RbacController', () => {
  let controller: RbacController;
  let service: jest.Mocked<Pick<RbacService, keyof RbacService>>;

  const mockUser: JwtPayload = {
    sub: 'user-1',
    org: 'org-1',
    email: 'admin@acme.com',
    roleVersion: 1,
    sessionId: 'session-1',
  };

  const mockRole = {
    id: 'role-1',
    organizationId: 'org-1',
    name: 'Editor',
    slug: 'editor',
    description: 'Can edit',
    isSystem: false,
    isOwner: false,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPermission = {
    id: 'perm-1',
    groupId: 'group-1',
    resource: 'invoice',
    action: 'read',
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

  const mockAuthService = { authorize: jest.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    service = {
      findAllRoles: jest.fn(),
      createRole: jest.fn(),
      findRoleById: jest.fn(),
      updateRole: jest.fn(),
      deleteRole: jest.fn(),
      restoreRole: jest.fn(),
      getRolePermissions: jest.fn(),
      setRolePermissions: jest.fn(),
      assignRole: jest.fn(),
      removeRole: jest.fn(),
      getUserRoles: jest.fn(),
      getAllPermissions: jest.fn(),
      getPermissionGroups: jest.fn(),
    } as unknown as jest.Mocked<Pick<RbacService, keyof RbacService>>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RbacController],
      providers: [
        { provide: RbacService, useValue: service },
        { provide: AuthorizationService, useValue: mockAuthService },
        Reflector,
      ],
    }).compile();

    controller = module.get<RbacController>(RbacController);
  });

  describe('findAllRoles', () => {
    it('should call service with org from JWT', async () => {
      const roles = [{ ...mockRole, _count: { userRoles: 0 } }];
      service.findAllRoles.mockResolvedValue(roles);

      const result = await controller.findAllRoles(mockUser);

      expect(service.findAllRoles).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(roles);
    });
  });

  describe('createRole', () => {
    it('should call service.createRole with org and dto', async () => {
      const dto: CreateRoleDto = { name: 'Editor', slug: 'editor' };
      service.createRole.mockResolvedValue(mockRole);

      const result = await controller.createRole(mockUser, dto);

      expect(service.createRole).toHaveBeenCalledWith('org-1', dto);
      expect(result).toEqual(mockRole);
    });
  });

  describe('findRole', () => {
    it('should call service.findRoleById', async () => {
      const roleWithPerms = {
        ...mockRole,
        rolePermissions: [],
        _count: { userRoles: 0 },
      };
      service.findRoleById.mockResolvedValue(roleWithPerms);

      const result = await controller.findRole(mockUser, 'role-1');

      expect(service.findRoleById).toHaveBeenCalledWith('org-1', 'role-1');
      expect(result).toEqual(roleWithPerms);
    });
  });

  describe('updateRole', () => {
    it('should call service.updateRole', async () => {
      const dto: UpdateRoleDto = { name: 'Senior Editor' };
      service.updateRole.mockResolvedValue({ ...mockRole, name: 'Senior Editor' });

      const result = await controller.updateRole(mockUser, 'role-1', dto);

      expect(service.updateRole).toHaveBeenCalledWith('org-1', 'role-1', dto);
      expect(result.name).toBe('Senior Editor');
    });
  });

  describe('deleteRole', () => {
    it('should call service.deleteRole and return message', async () => {
      service.deleteRole.mockResolvedValue(undefined);

      const result = await controller.deleteRole(mockUser, 'role-1');

      expect(service.deleteRole).toHaveBeenCalledWith('org-1', 'role-1', 'user-1');
      expect(result).toEqual({ message: 'Role deleted successfully' });
    });
  });

  describe('restoreRole', () => {
    it('should call service.restoreRole and return message', async () => {
      service.restoreRole.mockResolvedValue(undefined);

      const result = await controller.restoreRole(mockUser, 'role-1');

      expect(service.restoreRole).toHaveBeenCalledWith('org-1', 'role-1');
      expect(result).toEqual({ message: 'Role restored successfully' });
    });
  });

  describe('getRolePermissions', () => {
    it('should call service.getRolePermissions', async () => {
      service.getRolePermissions.mockResolvedValue([mockPermission]);

      const result = await controller.getRolePermissions(mockUser, 'role-1');

      expect(service.getRolePermissions).toHaveBeenCalledWith('org-1', 'role-1');
      expect(result).toEqual([mockPermission]);
    });
  });

  describe('setRolePermissions', () => {
    it('should call service.setRolePermissions and return message', async () => {
      service.setRolePermissions.mockResolvedValue(undefined);

      const result = await controller.setRolePermissions(mockUser, 'role-1', ['perm-1', 'perm-2']);

      expect(service.setRolePermissions).toHaveBeenCalledWith('org-1', 'role-1', [
        'perm-1',
        'perm-2',
      ]);
      expect(result).toEqual({ message: 'Role permissions updated successfully' });
    });
  });

  describe('assignRole', () => {
    it('should call service.assignRole and return message', async () => {
      const dto: AssignRoleDto = { roleId: 'role-1' };
      service.assignRole.mockResolvedValue(undefined);

      const result = await controller.assignRole(mockUser, 'user-2', dto);

      expect(service.assignRole).toHaveBeenCalledWith('org-1', 'user-2', 'role-1', 'user-1');
      expect(result).toEqual({ message: 'Role assigned successfully' });
    });
  });

  describe('removeRole', () => {
    it('should call service.removeRole and return message', async () => {
      service.removeRole.mockResolvedValue(undefined);

      const result = await controller.removeRole(mockUser, 'user-2', 'role-1');

      expect(service.removeRole).toHaveBeenCalledWith('org-1', 'user-2', 'role-1');
      expect(result).toEqual({ message: 'Role removed successfully' });
    });
  });

  describe('getUserRoles', () => {
    it('should call service.getUserRoles', async () => {
      service.getUserRoles.mockResolvedValue([mockRole]);

      const result = await controller.getUserRoles(mockUser, 'user-2');

      expect(service.getUserRoles).toHaveBeenCalledWith('org-1', 'user-2');
      expect(result).toEqual([mockRole]);
    });
  });

  describe('getAllPermissions', () => {
    it('should call service.getAllPermissions', async () => {
      service.getAllPermissions.mockResolvedValue([mockPermission]);

      const result = await controller.getAllPermissions();

      expect(service.getAllPermissions).toHaveBeenCalled();
      expect(result).toEqual([mockPermission]);
    });
  });

  describe('getPermissionGroups', () => {
    it('should call service.getPermissionGroups', async () => {
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
      service.getPermissionGroups.mockResolvedValue(groups);

      const result = await controller.getPermissionGroups();

      expect(service.getPermissionGroups).toHaveBeenCalled();
      expect(result).toEqual(groups);
    });
  });
});
