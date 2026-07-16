import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AIPermissionService } from '../authorization/ai-permission.service';
import { AuthorizationService } from '../../authorization/authorization.service';
import { ExecutionContext } from '../execution/execution-context';

describe('AIPermissionService', () => {
  let service: AIPermissionService;
  let mockAuthService: jest.Mocked<AuthorizationService>;

  const mockContext: ExecutionContext = {
    organizationId: 'org-1',
    userId: 'user-1',
    requestId: 'req-1',
  };

  beforeEach(async () => {
    mockAuthService = {
      authorize: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIPermissionService,
        {
          provide: AuthorizationService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    service = module.get<AIPermissionService>(AIPermissionService);
  });

  it('should return true when no permissions required', async () => {
    const result = await service.checkToolPermission('user-1', 'org-1', []);
    expect(result).toBe(true);
  });

  it('should return true when user has required permission', async () => {
    mockAuthService.authorize.mockResolvedValue(true);
    const result = await service.checkToolPermission('user-1', 'org-1', ['sales:read']);
    expect(result).toBe(true);
    expect(mockAuthService.authorize).toHaveBeenCalledWith('user-1', 'org-1', ['sales:read']);
  });

  it('should return false when user lacks permission', async () => {
    mockAuthService.authorize.mockResolvedValue(false);
    const result = await service.checkToolPermission('user-1', 'org-1', ['admin:access']);
    expect(result).toBe(false);
  });

  it('should return false when authorization throws', async () => {
    mockAuthService.authorize.mockRejectedValue(new Error('Service error'));
    const result = await service.checkToolPermission('user-1', 'org-1', ['sales:read']);
    expect(result).toBe(false);
  });

  it('should enforce permission and not throw when authorized', async () => {
    mockAuthService.authorize.mockResolvedValue(true);
    await expect(
      service.enforceToolPermission('user-1', 'org-1', ['sales:read']),
    ).resolves.toBeUndefined();
  });

  it('should enforce permission and throw when unauthorized', async () => {
    mockAuthService.authorize.mockResolvedValue(false);
    await expect(
      service.enforceToolPermission('user-1', 'org-1', ['admin:access']),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should validate organization access when org matches', () => {
    const result = service.validateOrganizationAccess(mockContext, 'org-1');
    expect(result).toBe(true);
  });

  it('should reject organization access when org mismatch', () => {
    const result = service.validateOrganizationAccess(mockContext, 'org-2');
    expect(result).toBe(false);
  });

  it('should pass organization validation when no tool org specified', () => {
    const result = service.validateOrganizationAccess(mockContext);
    expect(result).toBe(true);
  });

  it('should enforce organization access and not throw when valid', () => {
    expect(() => service.enforceOrganizationAccess(mockContext, 'org-1')).not.toThrow();
  });

  it('should enforce organization access and throw when invalid', () => {
    expect(() => service.enforceOrganizationAccess(mockContext, 'org-2')).toThrow(
      ForbiddenException,
    );
  });
});
