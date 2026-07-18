import { Test, TestingModule } from '@nestjs/testing';
import { AgentRouterService } from '../router/agent-router.service';
import { AgentFactoryService } from '../factory/agent-factory.service';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { CapabilityRegistryService } from '../../registry/capability-registry.service';
import {
  IAgent,
  AgentMetadata,
  AgentCapability,
  AgentRequest,
  AgentExecutionPlan,
  AgentResponse,
} from '../interfaces/agent.interface';

class MockRouterAgent implements IAgent {
  readonly metadata: AgentMetadata = {
    name: 'router-agent',
    description: 'Test agent for routing',
    version: '1.0.0',
    capabilities: [{ name: 'test-cap', description: 'Test capability', confidence: 0.9 }],
    requiredTools: [],
    supportedProviders: ['openai'],
    priority: 5,
    promptName: 'router-agent',
  };

  async canHandle(request: AgentRequest): Promise<AgentCapability | null> {
    if (request.text.toLowerCase().includes('route')) {
      return { name: 'test-cap', description: 'Test capability', confidence: 0.9 };
    }
    return null;
  }

  async plan(_request: AgentRequest): Promise<AgentExecutionPlan> {
    return {
      planId: 'p1',
      agentName: 'router-agent',
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
      agentName: 'router-agent',
      planId: 'p1',
      results: [],
      summary: 'done',
      duration: 10,
    };
  }
}

describe('AgentRouterService', () => {
  let service: AgentRouterService;
  let registry: AgentRegistryService;
  let capabilityRegistry: CapabilityRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRegistryService,
        AgentFactoryService,
        AgentRouterService,
        CapabilityRegistryService,
      ],
    }).compile();

    service = module.get<AgentRouterService>(AgentRouterService);
    registry = module.get<AgentRegistryService>(AgentRegistryService);
    capabilityRegistry = module.get<CapabilityRegistryService>(CapabilityRegistryService);
  });

  it('should route a request to the best matching agent', async () => {
    registry.register(new MockRouterAgent());
    const request: AgentRequest = {
      text: 'route this request',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const result = await service.route(request);
    expect(result.agent).toBeDefined();
    expect(result.agent.metadata.name).toBe('router-agent');
    expect(result.capability.name).toBe('test-cap');
    expect(result.plan).toBeDefined();
  });

  it('should enrich context with capability registry data when available', async () => {
    registry.register(new MockRouterAgent());
    capabilityRegistry.register({
      name: 'test-cap',
      description: 'Test capability',
      supportedTools: [],
      providerPreferences: [{ provider: 'openai', priority: 1 }],
      models: ['gpt-4o'],
      defaultTemperature: 0.3,
      contextLimit: 8192,
      streamingSupported: true,
    });

    const request: AgentRequest = {
      text: 'route this request',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const result = await service.route(request);
    expect(result.agent).toBeDefined();
    expect(result.capability.name).toBe('test-cap');
  });

  it('should throw when no agent matches', async () => {
    const request: AgentRequest = {
      text: 'something completely unrelated',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    await expect(service.route(request)).rejects.toThrow('No agent found');
  });

  it('should get agent for request', async () => {
    registry.register(new MockRouterAgent());
    const request: AgentRequest = {
      text: 'route this',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const agent = await service.getAgentForRequest(request);
    expect(agent).toBeDefined();
    expect(agent?.metadata.name).toBe('router-agent');
  });

  it('should get null agent for unmatched request', async () => {
    const request: AgentRequest = {
      text: 'unrelated',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const agent = await service.getAgentForRequest(request);
    expect(agent).toBeNull();
  });

  it('should get capability for request', async () => {
    registry.register(new MockRouterAgent());
    const request: AgentRequest = {
      text: 'route this',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const cap = await service.getCapabilityForRequest(request);
    expect(cap).toBeDefined();
    expect(cap?.name).toBe('test-cap');
  });
});
