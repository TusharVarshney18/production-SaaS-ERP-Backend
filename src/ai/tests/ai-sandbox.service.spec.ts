import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, BadRequestException, GatewayTimeoutException } from '@nestjs/common';
import { AISandboxService } from '../sandbox/ai-sandbox.service';
import { AIPermissionService } from '../authorization/ai-permission.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AITool } from '../tools/interfaces/ai-tool.interface';
import { ExecutionContext } from '../execution/execution-context';
import { AIToolResult, ToolParameter } from '../interfaces/runtime.interface';

class ValidTool implements AITool<{ id: string }, { value: string }> {
  readonly name = 'valid-tool';
  readonly description = 'A valid tool';
  readonly version = '1.0.0';
  readonly category = 'test';
  readonly parameters: ToolParameter[] = [
    { name: 'id', type: 'string', required: true, description: 'ID' },
  ];
  readonly permissions = ['test:read'];
  readonly timeout = 5000;
  readonly requiresConfirmation = false;
  readonly providerSupport = ['openai'];
  readonly metadata = {};

  async execute(
    input: { id: string },
    _context: ExecutionContext,
  ): Promise<AIToolResult<{ value: string }>> {
    return { success: true, data: { value: `result-${input.id}` }, duration: 5 };
  }
}

class NoPermissionTool implements AITool {
  readonly name = 'no-perm-tool';
  readonly description = 'Tool requiring admin';
  readonly version = '1.0.0';
  readonly category = 'admin';
  readonly parameters: ToolParameter[] = [];
  readonly permissions = ['admin:access'];
  readonly timeout = 5000;
  readonly requiresConfirmation = true;
  readonly providerSupport = ['openai'];
  readonly metadata = {};

  async execute(): Promise<AIToolResult> {
    return { success: true, data: null, duration: 5 };
  }
}

describe('AISandboxService', () => {
  let service: AISandboxService;
  let mockPermissionService: jest.Mocked<AIPermissionService>;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  const mockContext: ExecutionContext = {
    organizationId: 'org-1',
    userId: 'user-1',
    requestId: 'req-1',
  };

  beforeEach(async () => {
    mockPermissionService = {
      validateOrganizationAccess: jest.fn().mockReturnValue(true),
      checkToolPermission: jest.fn().mockResolvedValue(true),
    } as any;

    mockAuditLogService = {
      create: jest.fn().mockResolvedValue({}),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AISandboxService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const config: Record<string, unknown> = {
                'ai.sandboxTimeout': 30000,
                'ai.maxInputSize': 1048576,
                'ai.enableAudit': true,
                'ai.enableRateLimiting': false,
                'ai.sensitiveFields': [
                  'password',
                  'secret',
                  'token',
                  'apiKey',
                  'authorization',
                  'ssn',
                  'creditCard',
                ],
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: AIPermissionService,
          useValue: mockPermissionService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<AISandboxService>(AISandboxService);
  });

  describe('validateRequest', () => {
    it('should pass validation for valid request', async () => {
      const result = await service.validateRequest({ id: '123' }, new ValidTool(), mockContext);
      expect(result.valid).toBe(true);
    });

    it('should fail when org access is denied', async () => {
      mockPermissionService.validateOrganizationAccess.mockReturnValue(false);
      const result = await service.validateRequest({}, new ValidTool(), mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Organization access');
    });

    it('should fail when permissions are insufficient', async () => {
      mockPermissionService.checkToolPermission.mockResolvedValue(false);
      const result = await service.validateRequest({}, new NoPermissionTool(), mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Insufficient permissions');
    });

    it('should fail when input exceeds max size', async () => {
      const largeInput = { data: 'x'.repeat(2 * 1024 * 1024) };
      const result = await service.validateRequest(largeInput, new ValidTool(), mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Input size');
    });

    it('should pass validation when no permissions required', async () => {
      const toolWithoutPerms = new ValidTool();
      Object.defineProperty(toolWithoutPerms, 'permissions', { value: [] });
      const result = await service.validateRequest({}, toolWithoutPerms, mockContext);
      expect(result.valid).toBe(true);
    });
  });

  describe('enforceRequest', () => {
    it('should not throw for valid request', async () => {
      await expect(
        service.enforceRequest({ id: '123' }, new ValidTool(), mockContext),
      ).resolves.toBeUndefined();
    });

    it('should throw ForbiddenException for permission failure', async () => {
      mockPermissionService.checkToolPermission.mockResolvedValue(false);
      await expect(service.enforceRequest({}, new NoPermissionTool(), mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException for other failures', async () => {
      mockPermissionService.validateOrganizationAccess.mockReturnValue(false);
      await expect(service.enforceRequest({}, new ValidTool(), mockContext)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask sensitive fields in object', () => {
      const data = { username: 'alice', password: 'secret123', apiKey: 'sk-abc' };
      const masked = service.maskSensitiveData(data) as Record<string, unknown>;
      expect(masked.password).toBe('***');
      expect(masked.apiKey).toBe('***');
      expect(masked.username).toBe('alice');
    });

    it('should mask sensitive fields in JSON string', () => {
      const data = '{"password":"mypass","username":"bob"}';
      const masked = service.maskSensitiveData(data) as string;
      expect(masked).toContain('"password":"***"');
      expect(masked).not.toContain('mypass');
    });

    it('should not modify data without sensitive fields', () => {
      const data = { name: 'test', count: 5 };
      const masked = service.maskSensitiveData(data) as Record<string, unknown>;
      expect(masked.name).toBe('test');
      expect(masked.count).toBe(5);
    });

    it('should return primitive values as-is', () => {
      expect(service.maskSensitiveData(42)).toBe(42);
      expect(service.maskSensitiveData('hello')).toBe('hello');
      expect(service.maskSensitiveData(null)).toBeNull();
    });

    it('should mask url-encoded query params', () => {
      const data = 'token=abc123&user=test';
      const masked = service.maskSensitiveData(data) as string;
      expect(masked).toBe('token=***&user=test');
    });
  });

  describe('executeWithTimeout', () => {
    it('should resolve before timeout', async () => {
      const result = await service.executeWithTimeout(Promise.resolve('done'), 5000);
      expect(result).toBe('done');
    });

    it('should reject on timeout', async () => {
      await expect(
        service.executeWithTimeout(new Promise((resolve) => setTimeout(resolve, 1000)), 10),
      ).rejects.toThrow(GatewayTimeoutException);
    });

    it('should reject on execution error', async () => {
      await expect(
        service.executeWithTimeout(Promise.reject(new Error('exec error')), 5000),
      ).rejects.toThrow('exec error');
    });
  });

  describe('auditExecution', () => {
    it('should create audit log', async () => {
      await service.auditExecution({
        organizationId: 'org-1',
        userId: 'user-1',
        toolName: 'test-tool',
        success: true,
        duration: 10,
        requestId: 'req-1',
      });
      expect(mockAuditLogService.create).toHaveBeenCalled();
    });

    it('should create audit log with error details', async () => {
      await service.auditExecution({
        organizationId: 'org-1',
        userId: 'user-1',
        toolName: 'test-tool',
        success: false,
        duration: 5,
        error: 'Something went wrong',
        requestId: 'req-1',
      });
      expect(mockAuditLogService.create).toHaveBeenCalled();
    });

    it('should handle audit log creation failure gracefully', async () => {
      mockAuditLogService.create.mockRejectedValue(new Error('DB error'));
      await expect(
        service.auditExecution({
          organizationId: 'org-1',
          userId: 'user-1',
          toolName: 'test-tool',
          success: true,
          duration: 10,
          requestId: 'req-1',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
