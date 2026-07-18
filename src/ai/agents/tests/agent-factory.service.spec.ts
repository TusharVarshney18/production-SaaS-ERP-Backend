import { Test, TestingModule } from '@nestjs/testing';
import { AgentFactoryService } from '../factory/agent-factory.service';
import { AgentRegistryService } from '../registry/agent-registry.service';
import {
  IAgent,
  AgentMetadata,
  AgentCapability,
  AgentRequest,
  AgentExecutionPlan,
  AgentResponse,
} from '../interfaces/agent.interface';

class MockAgent implements IAgent {
  readonly metadata: AgentMetadata = {
    name: 'test-agent',
    description: 'Test agent',
    version: '1.0.0',
    capabilities: [{ name: 'test-capability', description: 'Test', confidence: 0.9 }],
    requiredTools: [],
    supportedProviders: ['openai'],
    priority: 1,
    promptName: 'test-agent',
  };

  async canHandle(request: AgentRequest): Promise<AgentCapability | null> {
    if (request.text.toLowerCase().includes('test')) {
      return { name: 'test-capability', description: 'Test', confidence: 0.9 };
    }
    return null;
  }

  async plan(_request: AgentRequest): Promise<AgentExecutionPlan> {
    return {
      planId: 'p1',
      agentName: 'test-agent',
      requestDescription: '',
      steps: [],
      estimatedComplexity: 'simple',
    };
  }

  async validate(_request: AgentRequest): Promise<string[]> {
    return [];
  }
  async execute(_request: AgentRequest): Promise<AgentResponse> {
    return {
      success: true,
      agentName: 'test-agent',
      planId: 'p1',
      results: [],
      summary: 'done',
      duration: 10,
    };
  }
}

describe('AgentFactoryService', () => {
  let service: AgentFactoryService;
  let registry: AgentRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentRegistryService, AgentFactoryService],
    }).compile();

    service = module.get<AgentFactoryService>(AgentFactoryService);
    registry = module.get<AgentRegistryService>(AgentRegistryService);
  });

  it('should get agent by name from registry', () => {
    const agent = new MockAgent();
    registry.register(agent);
    const found = service.getAgent('test-agent');
    expect(found).toBeDefined();
    expect(found?.metadata.name).toBe('test-agent');
  });

  it('should return undefined for unknown agent', () => {
    expect(service.getAgent('unknown')).toBeUndefined();
  });

  it('should resolve agent by metadata agentName', async () => {
    const agent = new MockAgent();
    registry.register(agent);
    const request: AgentRequest = {
      text: 'do something',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
      metadata: { agentName: 'test-agent' },
    };
    const resolved = await service.resolveAgent(request);
    expect(resolved).toBeDefined();
    expect(resolved?.metadata.name).toBe('test-agent');
  });

  it('should resolve agent by best match when no name specified', async () => {
    const agent = new MockAgent();
    registry.register(agent);
    const request: AgentRequest = {
      text: 'this is a test request',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const resolved = await service.resolveAgent(request);
    expect(resolved).toBeDefined();
    expect(resolved?.metadata.name).toBe('test-agent');
  });

  it('should return null when no agent can handle request', async () => {
    const agent = new MockAgent();
    registry.register(agent);
    const request: AgentRequest = {
      text: 'something completely unrelated',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const resolved = await service.resolveAgent(request);
    expect(resolved).toBeNull();
  });

  it('should get all agents', () => {
    registry.register(new MockAgent());
    expect(service.getAllAgents().length).toBe(1);
  });

  it('should get agent names', () => {
    registry.register(new MockAgent());
    expect(service.getAgentNames()).toContain('test-agent');
  });

  it('should check if agent exists', () => {
    registry.register(new MockAgent());
    expect(service.hasAgent('test-agent')).toBe(true);
    expect(service.hasAgent('unknown')).toBe(false);
  });
});
