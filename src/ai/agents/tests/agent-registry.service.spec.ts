import { Test, TestingModule } from '@nestjs/testing';
import { AgentRegistryService } from '../registry/agent-registry.service';
import {
  IAgent,
  AgentMetadata,
  AgentCapability,
  AgentRequest,
  AgentExecutionPlan,
  AgentResponse,
} from '../interfaces/agent.interface';

class MockSalesAgent implements IAgent {
  readonly metadata: AgentMetadata = {
    name: 'sales-agent',
    description: 'Handles sales queries',
    version: '1.0.0',
    capabilities: [
      { name: 'sales-analysis', description: 'Sales analysis', confidence: 0.95 },
      { name: 'customer-insights', description: 'Customer info', confidence: 0.85 },
    ],
    requiredTools: ['getSalesTotal', 'getCustomerInfo'],
    supportedProviders: ['openai', 'claude'],
    priority: 7,
    promptName: 'sales-agent',
  };

  async canHandle(request: AgentRequest): Promise<AgentCapability | null> {
    if (
      request.text.toLowerCase().includes('sales') ||
      request.text.toLowerCase().includes('revenue')
    ) {
      return { name: 'sales-analysis', description: 'Sales analysis', confidence: 0.95 };
    }
    return null;
  }

  async plan(_request: AgentRequest): Promise<AgentExecutionPlan> {
    return {
      planId: 'p1',
      agentName: 'sales-agent',
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
      agentName: 'sales-agent',
      planId: 'p1',
      results: [],
      summary: 'done',
      duration: 10,
    };
  }
}

class MockInventoryAgent implements IAgent {
  readonly metadata: AgentMetadata = {
    name: 'inventory-agent',
    description: 'Handles inventory queries',
    version: '1.0.0',
    capabilities: [{ name: 'stock-query', description: 'Stock levels', confidence: 0.95 }],
    requiredTools: ['getStockLevel'],
    supportedProviders: ['openai', 'gemini'],
    priority: 6,
    promptName: 'inventory-agent',
  };

  async canHandle(request: AgentRequest): Promise<AgentCapability | null> {
    if (
      request.text.toLowerCase().includes('stock') ||
      request.text.toLowerCase().includes('inventory')
    ) {
      return { name: 'stock-query', description: 'Stock levels', confidence: 0.95 };
    }
    return null;
  }

  async plan(_request: AgentRequest): Promise<AgentExecutionPlan> {
    return {
      planId: 'p2',
      agentName: 'inventory-agent',
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
      agentName: 'inventory-agent',
      planId: 'p2',
      results: [],
      summary: 'done',
      duration: 5,
    };
  }
}

describe('AgentRegistryService', () => {
  let service: AgentRegistryService;
  let salesAgent: MockSalesAgent;
  let inventoryAgent: MockInventoryAgent;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentRegistryService],
    }).compile();

    service = module.get<AgentRegistryService>(AgentRegistryService);
    salesAgent = new MockSalesAgent();
    inventoryAgent = new MockInventoryAgent();
  });

  it('should register an agent', () => {
    service.register(salesAgent);
    expect(service.has('sales-agent')).toBe(true);
    expect(service.getCount()).toBe(1);
  });

  it('should get an agent by name', () => {
    service.register(salesAgent);
    const agent = service.get('sales-agent');
    expect(agent).toBeDefined();
    expect(agent?.metadata.name).toBe('sales-agent');
  });

  it('should return undefined for unknown agent', () => {
    expect(service.get('unknown')).toBeUndefined();
  });

  it('should get all agents', () => {
    service.register(salesAgent);
    service.register(inventoryAgent);
    expect(service.getAll().length).toBe(2);
  });

  it('should find agents by capability', () => {
    service.register(salesAgent);
    service.register(inventoryAgent);
    const found = service.findByCapability('sales-analysis');
    expect(found.length).toBe(1);
    expect(found[0].metadata.name).toBe('sales-agent');
  });

  it('should find agents by tool', () => {
    service.register(salesAgent);
    service.register(inventoryAgent);
    const found = service.findByTool('getStockLevel');
    expect(found.length).toBe(1);
  });

  it('should find agents by provider', () => {
    service.register(salesAgent);
    service.register(inventoryAgent);
    const found = service.findByProvider('gemini');
    expect(found.length).toBe(1);
  });

  it('should find best match agent for a request', async () => {
    service.register(salesAgent);
    service.register(inventoryAgent);
    const request: AgentRequest = {
      text: 'What are our sales numbers?',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const best = await service.findBestMatch(request);
    expect(best).toBeDefined();
    expect(best?.metadata.name).toBe('sales-agent');
  });

  it('should return null when no agent matches', async () => {
    service.register(salesAgent);
    const request: AgentRequest = {
      text: 'What is the weather like?',
      context: { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    };
    const best = await service.findBestMatch(request);
    expect(best).toBeNull();
  });

  it('should search agents by name', () => {
    service.register(salesAgent);
    const results = service.search('sales');
    expect(results.length).toBe(1);
  });

  it('should remove an agent', () => {
    service.register(salesAgent);
    expect(service.remove('sales-agent')).toBe(true);
    expect(service.has('sales-agent')).toBe(false);
  });

  it('should return false when removing nonexistent agent', () => {
    expect(service.remove('nonexistent')).toBe(false);
  });

  it('should get agent names', () => {
    service.register(salesAgent);
    service.register(inventoryAgent);
    const names = service.getAgentNames();
    expect(names).toContain('sales-agent');
    expect(names).toContain('inventory-agent');
  });

  it('should get unique capabilities across all agents', () => {
    service.register(salesAgent);
    service.register(inventoryAgent);
    const caps = service.getCapabilities();
    expect(caps.length).toBe(3);
    expect(caps.find((c) => c.name === 'stock-query')).toBeDefined();
  });
});
