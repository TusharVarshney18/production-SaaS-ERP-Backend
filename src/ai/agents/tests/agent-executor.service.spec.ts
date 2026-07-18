import { Test, TestingModule } from '@nestjs/testing';
import { AgentExecutorService } from '../executor/agent-executor.service';
import { AgentRouterService } from '../router/agent-router.service';
import { AgentPlannerService } from '../planner/agent-planner.service';
import { ExecutionPipelineService } from '../../tools/execution/execution-pipeline.service';
import { PromptRegistryService } from '../../registry/prompt-registry.service';
import { AIGatewayService } from '../../core/ai-gateway.service';
import {
  IAgent,
  AgentMetadata,
  AgentCapability,
  AgentRequest,
  AgentExecutionPlan,
  AgentResponse,
} from '../interfaces/agent.interface';
import { ExecutionPipelineResult } from '../../interfaces/runtime.interface';

class ExecutorTestAgent implements IAgent {
  readonly metadata: AgentMetadata = {
    name: 'executor-agent',
    description: 'Test agent for executor',
    version: '1.0.0',
    capabilities: [{ name: 'execution', description: 'Execution', confidence: 0.9 }],
    requiredTools: ['test-tool'],
    supportedProviders: ['openai'],
    priority: 1,
    promptName: 'executor-agent',
  };

  async canHandle(request: AgentRequest): Promise<AgentCapability | null> {
    if (request.text.toLowerCase().includes('execute')) {
      return { name: 'execution', description: 'Execution', confidence: 0.9 };
    }
    return null;
  }

  async plan(_request: AgentRequest): Promise<AgentExecutionPlan> {
    return {
      planId: 'exec-plan',
      agentName: 'executor-agent',
      requestDescription: 'Test execution',
      steps: [
        {
          stepId: 'step-1',
          toolName: 'test-tool',
          input: { data: 'test' },
          description: 'Test step',
          dependsOn: [],
        },
      ],
      estimatedComplexity: 'simple',
    };
  }

  async validate(_request: AgentRequest): Promise<string[]> {
    return [];
  }

  async execute(_request: AgentRequest): Promise<AgentResponse> {
    return {
      success: true,
      agentName: 'executor-agent',
      planId: 'exec-plan',
      results: [],
      summary: 'done',
      duration: 10,
    };
  }
}

describe('AgentExecutorService', () => {
  let service: AgentExecutorService;
  let mockRouter: jest.Mocked<AgentRouterService>;
  let mockPlanner: jest.Mocked<AgentPlannerService>;
  let mockPipeline: jest.Mocked<ExecutionPipelineService>;

  beforeEach(async () => {
    mockRouter = { route: jest.fn() } as any;
    mockPlanner = { validatePlan: jest.fn() } as any;
    mockPipeline = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentExecutorService,
        { provide: AgentRouterService, useValue: mockRouter },
        { provide: AgentPlannerService, useValue: mockPlanner },
        { provide: ExecutionPipelineService, useValue: mockPipeline },
        { provide: PromptRegistryService, useValue: { get: jest.fn(), render: jest.fn() } },
        { provide: AIGatewayService, useValue: { chat: jest.fn(), toolCall: jest.fn() } },
      ],
    }).compile();

    service = module.get<AgentExecutorService>(AgentExecutorService);
  });

  it('should execute a request end-to-end', async () => {
    const agent = new ExecutorTestAgent();
    mockRouter.route.mockResolvedValue({
      agent,
      plan: await agent.plan({} as any),
      capability: null,
    } as any);
    mockPlanner.validatePlan.mockResolvedValue([]);
    mockPipeline.execute.mockResolvedValue({
      success: true,
      result: 'completed',
      duration: 10,
      toolName: 'test-tool',
      requestId: 'req-1',
      auditLogged: true,
    } as ExecutionPipelineResult);

    const request: AgentRequest = {
      text: 'execute this task',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };

    const response = await service.execute(request);
    expect(response.success).toBe(true);
    expect(response.agentName).toBe('executor-agent');
    expect(response.results.length).toBe(1);
  });

  it('should handle plan validation errors', async () => {
    const agent = new ExecutorTestAgent();
    mockRouter.route.mockResolvedValue({
      agent,
      plan: await agent.plan({} as any),
      capability: null,
    } as any);
    mockPlanner.validatePlan.mockResolvedValue(['Test error']);

    const request: AgentRequest = {
      text: 'execute this task',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };

    const response = await service.execute(request);
    expect(response.success).toBe(false);
    expect(response.error).toContain('Test error');
  });

  it('should handle routing errors gracefully', async () => {
    mockRouter.route.mockRejectedValue(new Error('No agent found'));

    const request: AgentRequest = {
      text: 'execute this task',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };

    const response = await service.execute(request);
    expect(response.success).toBe(false);
    expect(response.error).toContain('No agent found');
  });

  it('should handle tool execution failure', async () => {
    const agent = new ExecutorTestAgent();
    mockRouter.route.mockResolvedValue({
      agent,
      plan: await agent.plan({} as any),
      capability: null,
    } as any);
    mockPlanner.validatePlan.mockResolvedValue([]);
    mockPipeline.execute.mockResolvedValue({
      success: false,
      result: null,
      duration: 5,
      toolName: 'test-tool',
      requestId: 'req-1',
      error: 'Tool error',
      auditLogged: true,
    } as ExecutionPipelineResult);

    const request: AgentRequest = {
      text: 'execute this task',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };

    const response = await service.execute(request);
    expect(response.success).toBe(false);
    expect(response.results[0].success).toBe(false);
  });
});
