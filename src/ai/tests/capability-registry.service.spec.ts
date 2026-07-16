import { Test, TestingModule } from '@nestjs/testing';
import { CapabilityRegistryService } from '../registry/capability-registry.service';
import { CapabilityDefinition } from '../interfaces/runtime.interface';

describe('CapabilityRegistryService', () => {
  let service: CapabilityRegistryService;

  const salesCapability: CapabilityDefinition = {
    name: 'sales',
    description: 'Sales-related AI capabilities',
    supportedTools: ['getSalesOrders', 'createQuotation', 'getCustomerInfo'],
    providerPreferences: [
      { provider: 'openai', priority: 1, model: 'gpt-4o' },
      { provider: 'claude', priority: 2, model: 'claude-sonnet-4' },
    ],
    models: ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4'],
    defaultTemperature: 0.3,
    contextLimit: 8192,
    streamingSupported: true,
  };

  const inventoryCapability: CapabilityDefinition = {
    name: 'inventory',
    description: 'Inventory-related AI capabilities',
    supportedTools: ['getStockLevel', 'checkAvailability', 'transferStock'],
    providerPreferences: [{ provider: 'gemini', priority: 1, model: 'gemini-pro' }],
    models: ['gemini-pro', 'gemini-flash'],
    defaultTemperature: 0.2,
    contextLimit: 4096,
    streamingSupported: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CapabilityRegistryService],
    }).compile();

    service = module.get<CapabilityRegistryService>(CapabilityRegistryService);
  });

  it('should register a capability', () => {
    service.register(salesCapability);
    expect(service.get('sales')).toBeDefined();
    expect(service.has('sales')).toBe(true);
  });

  it('should get a capability by name', () => {
    service.register(salesCapability);
    const found = service.get('sales');
    expect(found?.description).toBe('Sales-related AI capabilities');
  });

  it('should return undefined for unknown capability', () => {
    expect(service.get('unknown')).toBeUndefined();
  });

  it('should get all capabilities', () => {
    service.register(salesCapability);
    service.register(inventoryCapability);
    expect(service.getAll().length).toBe(2);
  });

  it('should get count', () => {
    service.register(salesCapability);
    expect(service.getCount()).toBe(1);
  });

  it('should find capabilities by tool name', () => {
    service.register(salesCapability);
    service.register(inventoryCapability);
    const found = service.findByTool('getSalesOrders');
    expect(found.length).toBe(1);
    expect(found[0].name).toBe('sales');
  });

  it('should find capabilities by model', () => {
    service.register(salesCapability);
    const found = service.findByModel('gpt-4o');
    expect(found.length).toBe(1);
  });

  it('should find capabilities by provider', () => {
    service.register(salesCapability);
    const found = service.findByProvider('openai');
    expect(found.length).toBe(1);
  });

  it('should return empty array when no capabilities match tool', () => {
    expect(service.findByTool('nonexistent')).toEqual([]);
  });

  it('should get supported tools for a capability', () => {
    service.register(salesCapability);
    const tools = service.getSupportedTools('sales');
    expect(tools).toContain('getSalesOrders');
    expect(tools.length).toBe(3);
  });

  it('should get default temperature', () => {
    service.register(salesCapability);
    expect(service.getDefaultTemperature('sales')).toBe(0.3);
  });

  it('should get context limit', () => {
    service.register(salesCapability);
    expect(service.getContextLimit('sales')).toBe(8192);
  });

  it('should check streaming support', () => {
    service.register(salesCapability);
    service.register(inventoryCapability);
    expect(service.supportsStreaming('sales')).toBe(true);
    expect(service.supportsStreaming('inventory')).toBe(false);
  });

  it('should get provider preferences', () => {
    service.register(salesCapability);
    const prefs = service.getProviderPreferences('sales');
    expect(prefs.length).toBe(2);
    expect(prefs[0].provider).toBe('openai');
  });

  it('should remove a capability', () => {
    service.register(salesCapability);
    expect(service.remove('sales')).toBe(true);
    expect(service.has('sales')).toBe(false);
  });

  it('should return false when removing nonexistent capability', () => {
    expect(service.remove('nonexistent')).toBe(false);
  });

  it('should update a capability', () => {
    service.register(salesCapability);
    expect(service.update('sales', { defaultTemperature: 0.5 })).toBe(true);
    expect(service.get('sales')?.defaultTemperature).toBe(0.5);
  });

  it('should return false when updating nonexistent capability', () => {
    expect(service.update('nonexistent', {})).toBe(false);
  });

  it('should search capabilities by name', () => {
    service.register(salesCapability);
    const results = service.search('sales');
    expect(results.length).toBe(1);
  });

  it('should search capabilities by description', () => {
    service.register(salesCapability);
    const results = service.search('inventory');
    expect(results.length).toBe(0);
  });

  it('should search capabilities by tool name', () => {
    service.register(salesCapability);
    const results = service.search('getSalesOrders');
    expect(results.length).toBe(1);
  });
});
