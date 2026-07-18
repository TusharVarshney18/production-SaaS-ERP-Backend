import { Test, TestingModule } from '@nestjs/testing';
import { ContextBuilderService } from '../context/context-builder.service';
import { ToolRegistryService } from '../../registry/tool-registry.service';
import { CapabilityRegistryService } from '../../registry/capability-registry.service';
import { ProviderFactory } from '../../providers/provider.factory';
import { ConfigService } from '@nestjs/config';
import { AITool } from '../../tools/interfaces/ai-tool.interface';
import { ExecutionContext } from '../../execution/execution-context';
import { AIToolResult, ToolParameter } from '../../interfaces/runtime.interface';

class DummyTool implements AITool {
  readonly name = 'dummy';
  readonly description = 'Dummy';
  readonly version = '1.0.0';
  readonly category = 'test';
  readonly parameters: ToolParameter[] = [];
  readonly permissions = [];
  readonly timeout = 5000;
  readonly requiresConfirmation = false;
  readonly providerSupport = ['openai'];
  readonly metadata = {};
  async execute(_input: unknown, _context: ExecutionContext): Promise<AIToolResult> {
    return { success: true, data: null, duration: 0 };
  }
}

describe('ContextBuilderService', () => {
  let service: ContextBuilderService;
  let toolRegistry: ToolRegistryService;
  let capabilityRegistry: CapabilityRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextBuilderService,
        ToolRegistryService,
        CapabilityRegistryService,
        ProviderFactory,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'ai.temperature') return 0.7;
              if (key === 'ai.streaming') return true;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ContextBuilderService>(ContextBuilderService);
    toolRegistry = module.get<ToolRegistryService>(ToolRegistryService);
    capabilityRegistry = module.get<CapabilityRegistryService>(CapabilityRegistryService);
  });

  it('should build base context with default metadata', () => {
    const context = service.buildBaseContext({
      organizationId: 'org-1',
      userId: 'user-1',
      requestId: 'req-1',
    });
    expect(context.organizationId).toBe('org-1');
    expect(context.userId).toBe('user-1');
    expect(context.metadata).toBeDefined();
    expect(context.metadata?.availableTools).toEqual([]);
    expect(context.metadata?.availableCapabilities).toEqual([]);
    expect(context.metadata?.availableProviders).toEqual([]);
  });

  it('should include registered tools in metadata', () => {
    toolRegistry.register(new DummyTool());
    const context = service.buildBaseContext({
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(context.metadata?.availableTools).toContain('dummy');
  });

  it('should include registered capabilities in metadata', () => {
    capabilityRegistry.register({
      name: 'test-cap',
      description: 'Test',
      supportedTools: [],
      providerPreferences: [],
      models: [],
      defaultTemperature: 0.5,
      contextLimit: 4096,
      streamingSupported: true,
    });
    const context = service.buildBaseContext({
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(context.metadata?.availableCapabilities).toContain('test-cap');
  });

  it('should build context with extra metadata', () => {
    const context = service.buildContext({
      organizationId: 'org-1',
      userId: 'user-1',
      extraMetadata: { customKey: 'customValue' },
    });
    expect(context.metadata?.customKey).toBe('customValue');
  });

  it('should include optional fields when provided', () => {
    const context = service.buildBaseContext({
      organizationId: 'org-1',
      userId: 'user-1',
      correlationId: 'corr-1',
      role: 'admin',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
    expect(context.correlationId).toBe('corr-1');
    expect(context.role).toBe('admin');
    expect(context.ipAddress).toBe('127.0.0.1');
    expect(context.userAgent).toBe('test-agent');
  });

  it('should get available tools summary', () => {
    toolRegistry.register(new DummyTool());
    const summary = service.getAvailableToolsSummary();
    expect(summary.length).toBe(1);
    expect(summary[0].name).toBe('dummy');
  });

  it('should get provider summary', () => {
    const summary = service.getProviderSummary();
    expect(Array.isArray(summary)).toBe(true);
  });

  it('should get capability summary', () => {
    capabilityRegistry.register({
      name: 'test-cap',
      description: 'Test',
      supportedTools: ['tool1'],
      providerPreferences: [],
      models: [],
      defaultTemperature: 0.5,
      contextLimit: 4096,
      streamingSupported: true,
    });
    const summary = service.getCapabilitySummary();
    expect(summary.length).toBe(1);
    expect(summary[0].name).toBe('test-cap');
    expect(summary[0].tools).toContain('tool1');
  });
});
