import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AuthorizationService } from '../authorization.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    service = new AuthorizationService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authorize', () => {
    it('should return true when user has the required permission', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        userRoles: [
          {
            role: {
              isOwner: false,
              rolePermissions: [
                { permission: { resource: 'invoice', action: 'read' } },
                { permission: { resource: 'invoice', action: 'create' } },
              ],
            },
          },
        ],
      });

      const result = await service.authorize('user-1', 'org-1', ['invoice:read']);

      expect(result).toBe(true);
    });

    it('should return true when user has wildcard action for resource', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        userRoles: [
          {
            role: {
              isOwner: false,
              rolePermissions: [{ permission: { resource: 'invoice', action: '*' } }],
            },
          },
        ],
      });

      const result = await service.authorize('user-1', 'org-1', ['invoice:create']);

      expect(result).toBe(true);
    });

    it('should return true when user is owner', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        userRoles: [
          {
            role: {
              isOwner: true,
              rolePermissions: [],
            },
          },
        ],
      });

      const result = await service.authorize('user-1', 'org-1', [
        'invoice:read',
        'organization:update',
      ]);

      expect(result).toBe(true);
    });

    it('should return false when user lacks permission', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        userRoles: [
          {
            role: {
              isOwner: false,
              rolePermissions: [{ permission: { resource: 'invoice', action: 'read' } }],
            },
          },
        ],
      });

      const result = await service.authorize('user-1', 'org-1', ['invoice:delete']);

      expect(result).toBe(false);
    });

    it('should return false for user not found', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.authorize('nonexistent', 'org-1', ['invoice:read']);

      expect(result).toBe(false);
    });

    it('should return false when user has no roles', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        userRoles: [],
      });

      const result = await service.authorize('user-1', 'org-1', ['invoice:read']);

      expect(result).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return list of resolved permissions', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        userRoles: [
          {
            role: {
              isOwner: false,
              rolePermissions: [
                { permission: { resource: 'invoice', action: 'read' } },
                { permission: { resource: 'invoice', action: 'create' } },
              ],
            },
          },
        ],
      });

      const result = await service.getUserPermissions('user-1', 'org-1');

      expect(result).toEqual([
        { resource: 'invoice', action: 'read' },
        { resource: 'invoice', action: 'create' },
      ]);
    });

    it('should return wildcard for owner', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        userRoles: [
          {
            role: {
              isOwner: true,
              rolePermissions: [],
            },
          },
        ],
      });

      const result = await service.getUserPermissions('user-1', 'org-1');

      expect(result).toEqual([{ resource: '*', action: '*' }]);
    });

    it('should return empty array for unknown user', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getUserPermissions('nonexistent', 'org-1');

      expect(result).toEqual([]);
    });

    it('should deduplicate permissions across multiple roles', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        userRoles: [
          {
            role: {
              isOwner: false,
              rolePermissions: [{ permission: { resource: 'invoice', action: 'read' } }],
            },
          },
          {
            role: {
              isOwner: false,
              rolePermissions: [
                { permission: { resource: 'invoice', action: 'read' } },
                { permission: { resource: 'product', action: 'create' } },
              ],
            },
          },
        ],
      });

      const result = await service.getUserPermissions('user-1', 'org-1');

      expect(result).toEqual([
        { resource: 'invoice', action: 'read' },
        { resource: 'product', action: 'create' },
      ]);
    });
  });
});
