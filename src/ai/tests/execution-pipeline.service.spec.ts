import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ExecutionPipelineService } from '../tools/execution/execution-pipeline.service';
import { ToolRegistryService } from '../registry/tool-registry.service';
import { AISandboxService } from '../sandbox/ai-sandbox.service';
import { AIPermissionService } from '../authorization/ai-permission.service';
import { AITool } from '../tools/interfaces/ai-tool.interface';
import { ExecutionContext } from '../execution/execution-context';
import { AIToolResult, ToolParameter } from '../interfaces/runtime.interface';

class SuccessfulTool implements AITool<{ id: string }, { result: string }> {
  readonly name = 'success-tool';
  readonly description = 'Always succeeds';
  readonly version = '1.0.0';
  readonly category = 'test';
  readonly parameters: ToolParameter[] = [
    { name: 'id', type: 'string', required: true, description: 'Input ID' },
  ];
  readonly permissions = [];
  readonly timeout = 5000;
  readonly requiresConfirmation = false;
  readonly providerSupport = ['openai'];
  readonly metadata = {};

  async execute(
    input: { id: string },
    _context: ExecutionContext,
  ): Promise<AIToolResult<{ result: string }>> {
    return { success: true, data: { result: `processed-${input.id}` }, duration: 5 };
  }
}

class FailingTool implements AITool {
  readonly name = 'fail-tool';
  readonly description = 'Always fails';
  readonly version = '1.0.0';
  readonly category = 'test';
  readonly parameters: ToolParameter[] = [];
  readonly permissions = [];
  readonly timeout = 5000;
  readonly requiresConfirmation = false;
  readonly providerSupport = ['openai'];
  readonly metadata = {};

  async execute(): Promise<AIToolResult> {
    return { success: false, data: null, error: 'Tool execution error', duration: 5 };
  }
}

describe('ExecutionPipelineService', () => {
  let service: ExecutionPipelineService;
  let toolRegistry: ToolRegistryService;
  let mockSandbox: jest.Mocked<AISandboxService>;
  let mockPermissionService: jest.Mocked<AIPermissionService>;

  const mockContext: ExecutionContext = {
    organizationId: 'org-1',
    userId: 'user-1',
    requestId: 'req-1',
  };

  beforeEach(async () => {
    mockSandbox = {
      enforceRequest: jest.fn(),
      executeWithTimeout: jest.fn(),
      auditExecution: jest.fn(),
    } as any;

    mockPermissionService = {
      enforceToolPermission: jest.fn(),
      enforceOrganizationAccess: jest.fn(),
      checkToolPermission: jest.fn(),
      validateOrganizationAccess: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionPipelineService,
        ToolRegistryService,
        {
          provide: AISandboxService,
          useValue: mockSandbox,
        },
        {
          provide: AIPermissionService,
          useValue: mockPermissionService,
        },
      ],
    }).compile();

    service = module.get<ExecutionPipelineService>(ExecutionPipelineService);
    toolRegistry = module.get<ToolRegistryService>(ToolRegistryService);
  });

  it('should successfully execute a tool through the pipeline', async () => {
    toolRegistry.register(new SuccessfulTool());
    mockSandbox.enforceRequest.mockResolvedValue(undefined);
    mockPermissionService.enforceToolPermission.mockResolvedValue(undefined);
    mockPermissionService.enforceOrganizationAccess.mockImplementation(() => {});
    mockSandbox.executeWithTimeout.mockImplementation((promise) => promise);
    mockSandbox.auditExecution.mockResolvedValue(undefined);

    const result = await service.execute('success-tool', { id: 'abc' }, mockContext);

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ result: 'processed-abc' });
    expect(result.toolName).toBe('success-tool');
    expect(result.auditLogged).toBe(true);
  });

  it('should return error when tool is not found', async () => {
    const result = await service.execute('unknown-tool', {}, mockContext);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(result.auditLogged).toBe(true);
  });

  it('should return error when sandbox rejects', async () => {
    toolRegistry.register(new SuccessfulTool());
    mockSandbox.enforceRequest.mockRejectedValue(new ForbiddenException('No permission'));

    const result = await service.execute('success-tool', {}, mockContext);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error when tool execution fails', async () => {
    toolRegistry.register(new FailingTool());
    mockSandbox.enforceRequest.mockResolvedValue(undefined);
    mockPermissionService.enforceToolPermission.mockResolvedValue(undefined);
    mockPermissionService.enforceOrganizationAccess.mockImplementation(() => {});
    mockSandbox.executeWithTimeout.mockImplementation((promise) => promise);

    const result = await service.execute('fail-tool', {}, mockContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Tool execution error');
    expect(result.auditLogged).toBe(true);
  });

  it('should process batch executions', async () => {
    toolRegistry.register(new SuccessfulTool());
    mockSandbox.enforceRequest.mockResolvedValue(undefined);
    mockPermissionService.enforceToolPermission.mockResolvedValue(undefined);
    mockPermissionService.enforceOrganizationAccess.mockImplementation(() => {});
    mockSandbox.executeWithTimeout.mockImplementation((promise) => promise);
    mockSandbox.auditExecution.mockResolvedValue(undefined);

    const results = await service.executeBatch(
      [
        { toolName: 'success-tool', input: { id: '1' } },
        { toolName: 'success-tool', input: { id: '2' } },
      ],
      mockContext,
    );

    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });

  it('should include requestId in result', async () => {
    toolRegistry.register(new SuccessfulTool());
    mockSandbox.enforceRequest.mockResolvedValue(undefined);
    mockPermissionService.enforceToolPermission.mockResolvedValue(undefined);
    mockPermissionService.enforceOrganizationAccess.mockImplementation(() => {});
    mockSandbox.executeWithTimeout.mockImplementation((promise) => promise);
    mockSandbox.auditExecution.mockResolvedValue(undefined);

    const result = await service.execute('success-tool', { id: 'x' }, mockContext);
    expect(result.requestId).toBe('req-1');
  });
});
