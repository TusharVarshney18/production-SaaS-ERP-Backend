import { Test, TestingModule } from '@nestjs/testing';
import { AgentPlannerService } from '../planner/agent-planner.service';
import { PromptRegistryService } from '../../registry/prompt-registry.service';
import { ToolRegistryService } from '../../registry/tool-registry.service';
import { ConfigService } from '@nestjs/config';
import {
  IAgent,
  AgentMetadata,
  AgentCapability,
  AgentRequest,
  AgentExecutionPlan,
  AgentResponse,
} from '../interfaces/agent.interface';
import { AITool } from '../../tools/interfaces/ai-tool.interface';
import { ExecutionContext } from '../../execution/execution-context';
import { AIToolResult, ToolParameter } from '../../interfaces/runtime.interface';

class MockTool implements AITool {
  readonly name = 'test-tool';
  readonly description = 'Test tool';
  readonly version = '1.0.0';
  readonly category = 'test';
  readonly parameters: ToolParameter[] = [];
  readonly permissions = [];
  readonly timeout = 5000;
  readonly requiresConfirmation = false;
  readonly providerSupport = ['openai'];
  readonly metadata = {};

  async execute(_input: unknown, _context: ExecutionContext): Promise<AIToolResult> {
    return { success: true, data: 'done', duration: 5 };
  }
}

class TestPlannerAgent implements IAgent {
  readonly metadata: AgentMetadata = {
    name: 'planner-agent',
    description: 'Test agent',
    version: '1.0.0',
    capabilities: [{ name: 'planning', description: 'Planning', confidence: 0.9 }],
    requiredTools: ['test-tool'],
    supportedProviders: ['openai'],
    priority: 1,
    promptName: 'planner-agent',
  };

  async canHandle(_request: AgentRequest): Promise<AgentCapability | null> {
    return { name: 'planning', description: 'Planning', confidence: 0.9 };
  }

  async plan(_request: AgentRequest): Promise<AgentExecutionPlan> {
    return {
      planId: 'test-plan',
      agentName: 'planner-agent',
      requestDescription: 'Test plan',
      steps: [
        {
          stepId: 'step-1',
          toolName: 'test-tool',
          input: { key: 'value' },
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
      agentName: 'planner-agent',
      planId: 'test-plan',
      results: [],
      summary: 'done',
      duration: 10,
    };
  }
}

describe('AgentPlannerService', () => {
  let service: AgentPlannerService;
  let toolRegistry: ToolRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentPlannerService,
        PromptRegistryService,
        ToolRegistryService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => '') },
        },
      ],
    }).compile();

    service = module.get<AgentPlannerService>(AgentPlannerService);
    toolRegistry = module.get<ToolRegistryService>(ToolRegistryService);
  });

  it('should create a plan from agent', async () => {
    const agent = new TestPlannerAgent();
    const request: AgentRequest = {
      text: 'test',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const plan = await service.createPlan(agent, request);
    expect(plan.planId).toBe('test-plan');
    expect(plan.steps.length).toBe(1);
  });

  it('should override tool inputs when provided', async () => {
    const agent = new TestPlannerAgent();
    const request: AgentRequest = {
      text: 'test',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const plan = await service.createPlan(agent, request, { 'test-tool': { custom: 'input' } });
    expect(plan.steps[0].input).toEqual({ custom: 'input' });
  });

  it('should validate a valid plan', async () => {
    toolRegistry.register(new MockTool());
    const plan: AgentExecutionPlan = {
      planId: 'p1',
      agentName: 'test',
      requestDescription: '',
      steps: [{ stepId: 's1', toolName: 'test-tool', input: {}, description: '', dependsOn: [] }],
      estimatedComplexity: 'simple',
    };
    const errors = await service.validatePlan(plan);
    expect(errors.length).toBe(0);
  });

  it('should catch missing planId', async () => {
    const plan: AgentExecutionPlan = {
      planId: '',
      agentName: 'test',
      requestDescription: '',
      steps: [{ stepId: 's1', toolName: 'test-tool', input: {}, description: '', dependsOn: [] }],
      estimatedComplexity: 'simple',
    };
    const errors = await service.validatePlan(plan);
    expect(errors).toContain('Plan must have a planId');
  });

  it('should catch missing toolName in step', async () => {
    const plan: AgentExecutionPlan = {
      planId: 'p1',
      agentName: 'test',
      requestDescription: '',
      steps: [{ stepId: 's1', toolName: '', input: {}, description: '', dependsOn: [] }],
      estimatedComplexity: 'simple',
    };
    const errors = await service.validatePlan(plan);
    expect(errors.some((e) => e.includes('missing toolName'))).toBe(true);
  });

  it('should catch unknown tool reference', async () => {
    const plan: AgentExecutionPlan = {
      planId: 'p1',
      agentName: 'test',
      requestDescription: '',
      steps: [
        { stepId: 's1', toolName: 'unknown-tool', input: {}, description: '', dependsOn: [] },
      ],
      estimatedComplexity: 'simple',
    };
    const errors = await service.validatePlan(plan);
    expect(errors.some((e) => e.includes('unknown tool'))).toBe(true);
  });

  it('should catch missing step dependency', async () => {
    const plan: AgentExecutionPlan = {
      planId: 'p1',
      agentName: 'test',
      requestDescription: '',
      steps: [
        { stepId: 's2', toolName: 'test-tool', input: {}, description: '', dependsOn: ['s1'] },
      ],
      estimatedComplexity: 'simple',
    };
    const errors = await service.validatePlan(plan);
    expect(errors.some((e) => e.includes('depends on unknown step'))).toBe(true);
  });

  it('should estimate complexity based on step count', () => {
    expect(
      service.estimateComplexity([
        { stepId: 's1', toolName: 't', input: {}, description: '', dependsOn: [] },
      ]),
    ).toBe('simple');
    expect(
      service.estimateComplexity([
        { stepId: 's1', toolName: 't', input: {}, description: '', dependsOn: [] },
        { stepId: 's2', toolName: 't', input: {}, description: '', dependsOn: [] },
        { stepId: 's3', toolName: 't', input: {}, description: '', dependsOn: [] },
      ]),
    ).toBe('medium');
    expect(
      service.estimateComplexity([
        { stepId: 's1', toolName: 't', input: {}, description: '', dependsOn: [] },
        { stepId: 's2', toolName: 't', input: {}, description: '', dependsOn: [] },
        { stepId: 's3', toolName: 't', input: {}, description: '', dependsOn: [] },
        { stepId: 's4', toolName: 't', input: {}, description: '', dependsOn: [] },
      ]),
    ).toBe('complex');
  });
});
