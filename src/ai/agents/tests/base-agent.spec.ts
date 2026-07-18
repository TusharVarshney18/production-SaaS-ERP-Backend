import { Test, TestingModule } from '@nestjs/testing';
import { BaseAgent } from '../agents/base.agent';
import { PromptRegistryService } from '../../registry/prompt-registry.service';
import { ToolRegistryService } from '../../registry/tool-registry.service';
import { ExecutionPipelineService } from '../../tools/execution/execution-pipeline.service';
import { AISandboxService } from '../../sandbox/ai-sandbox.service';
import { AIPermissionService } from '../../authorization/ai-permission.service';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../../../audit-log/audit-log.service';
import { AuthorizationService } from '../../../authorization/authorization.service';
import {
  AgentMetadata,
  AgentCapability,
  AgentRequest,
  AgentExecutionPlan,
} from '../interfaces/agent.interface';
import { AITool } from '../../tools/interfaces/ai-tool.interface';
import { ExecutionContext } from '../../execution/execution-context';
import { AIToolResult, ToolParameter } from '../../interfaces/runtime.interface';

class MockTool implements AITool {
  readonly name = 'test-tool';
  readonly description = 'Test';
  readonly version = '1.0.0';
  readonly category = 'test';
  readonly parameters: ToolParameter[] = [];
  readonly permissions = [];
  readonly timeout = 5000;
  readonly requiresConfirmation = false;
  readonly providerSupport = ['openai'];
  readonly metadata = {};

  async execute(_input: unknown, _context: ExecutionContext): Promise<AIToolResult> {
    return { success: true, data: 'tool-result', duration: 5 };
  }
}

class ConcreteAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    name: 'concrete-agent',
    description: 'A concrete test agent',
    version: '1.0.0',
    capabilities: [{ name: 'test', description: 'Test capability', confidence: 0.9 }],
    requiredTools: ['test-tool'],
    supportedProviders: ['openai'],
    priority: 1,
    promptName: 'concrete-agent',
  };

  async canHandle(request: AgentRequest): Promise<AgentCapability | null> {
    if (request.text.toLowerCase().includes('concrete')) {
      return { name: 'test', description: 'Test capability', confidence: 0.9 };
    }
    return null;
  }

  async plan(_request: AgentRequest): Promise<AgentExecutionPlan> {
    return {
      planId: 'concrete-plan',
      agentName: 'concrete-agent',
      requestDescription: 'Concrete test',
      steps: [
        { stepId: 'step-1', toolName: 'test-tool', input: {}, description: 'Test', dependsOn: [] },
      ],
      estimatedComplexity: 'simple',
    };
  }
}

describe('BaseAgent', () => {
  let agent: ConcreteAgent;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptRegistryService,
        ToolRegistryService,
        ExecutionPipelineService,
        AISandboxService,
        AIPermissionService,
        ConcreteAgent,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const cfg: Record<string, unknown> = {
                'ai.sandboxTimeout': 30000,
                'ai.maxInputSize': 1048576,
                'ai.enableAudit': false,
                'ai.enableRateLimiting': false,
                'ai.sensitiveFields': ['password'],
                'ai.promptCacheTtl': 300000,
                'ai.promptsDir': '',
              };
              return cfg[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: AuditLogService,
          useValue: { create: jest.fn() },
        },
        {
          provide: AuthorizationService,
          useValue: { authorize: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    agent = module.get<ConcreteAgent>(ConcreteAgent);
    const toolRegistry = module.get<ToolRegistryService>(ToolRegistryService);
    toolRegistry.register(new MockTool());
  });

  it('should have correct metadata', () => {
    expect(agent.metadata.name).toBe('concrete-agent');
    expect(agent.metadata.capabilities.length).toBe(1);
    expect(agent.metadata.requiredTools).toContain('test-tool');
  });

  it('should handle matching request', async () => {
    const request: AgentRequest = {
      text: 'concrete request',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const capability = await agent.canHandle(request);
    expect(capability).toBeDefined();
    expect(capability?.name).toBe('test');
  });

  it('should not handle non-matching request', async () => {
    const request: AgentRequest = {
      text: 'something else',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const capability = await agent.canHandle(request);
    expect(capability).toBeNull();
  });

  it('should create a plan', async () => {
    const request: AgentRequest = {
      text: 'concrete request',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const plan = await agent.plan(request);
    expect(plan.planId).toBe('concrete-plan');
    expect(plan.steps.length).toBe(1);
  });

  it('should validate missing request text', async () => {
    const request: AgentRequest = {
      text: '',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const errors = await agent.validate(request);
    expect(errors).toContain('Request text is required');
  });

  it('should validate missing organization ID', async () => {
    const request: AgentRequest = {
      text: 'test',
      context: { organizationId: '', userId: 'user-1', requestId: 'req-1' },
    };
    const errors = await agent.validate(request);
    expect(errors).toContain('Organization ID is required in context');
  });

  it('should validate missing user ID', async () => {
    const request: AgentRequest = {
      text: 'test',
      context: { organizationId: 'org-1', userId: '', requestId: 'req-1' },
    };
    const errors = await agent.validate(request);
    expect(errors).toContain('User ID is required in context');
  });

  it('should pass validation for valid request', async () => {
    const request: AgentRequest = {
      text: 'concrete request',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const errors = await agent.validate(request);
    expect(errors.length).toBe(0);
  });

  it('should create steps with proper structure', () => {
    const step = (agent as any).createStep('test-tool', { data: 1 }, 'description', ['dep-1']);
    expect(step.toolName).toBe('test-tool');
    expect(step.input).toEqual({ data: 1 });
    expect(step.description).toBe('description');
    expect(step.dependsOn).toEqual(['dep-1']);
    expect(step.stepId).toBeDefined();
  });

  it('should get prompt variables from request', () => {
    const request: AgentRequest = {
      text: 'test request',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const vars = (agent as any).getPromptVariables(request);
    expect(vars.organizationId).toBe('org-1');
    expect(vars.userId).toBe('user-1');
    expect(vars.request).toBe('test request');
  });
});
