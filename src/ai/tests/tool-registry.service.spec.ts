import { Test, TestingModule } from '@nestjs/testing';
import { ToolRegistryService } from '../registry/tool-registry.service';
import { AITool } from '../tools/interfaces/ai-tool.interface';
import { ExecutionContext } from '../execution/execution-context';
import { AIToolResult, ToolParameter } from '../interfaces/runtime.interface';

class MockSalesTool implements AITool<{ customerId: string }, { total: number }> {
  readonly name = 'getSalesTotal';
  readonly description = 'Get total sales for a customer';
  readonly version = '1.0.0';
  readonly category = 'sales';
  readonly parameters: ToolParameter[] = [
    { name: 'customerId', type: 'string', required: true, description: 'Customer ID' },
  ];
  readonly permissions = ['sales:read'];
  readonly timeout = 5000;
  readonly requiresConfirmation = false;
  readonly providerSupport = ['openai', 'claude'];
  readonly metadata = { domain: 'sales', cacheable: true };

  async execute(
    _input: { customerId: string },
    _context: ExecutionContext,
  ): Promise<AIToolResult<{ total: number }>> {
    return { success: true, data: { total: 1000 }, duration: 10 };
  }
}

class MockInventoryTool implements AITool<{ productId: string }, { qty: number }> {
  readonly name = 'getStockLevel';
  readonly description = 'Check stock level for a product';
  readonly version = '1.0.0';
  readonly category = 'inventory';
  readonly parameters: ToolParameter[] = [
    { name: 'productId', type: 'string', required: true, description: 'Product ID' },
  ];
  readonly permissions = ['stock:read'];
  readonly timeout = 3000;
  readonly requiresConfirmation = false;
  readonly providerSupport = ['openai', 'gemini'];
  readonly metadata = { domain: 'inventory' };

  async execute(
    _input: { productId: string },
    _context: ExecutionContext,
  ): Promise<AIToolResult<{ qty: number }>> {
    return { success: true, data: { qty: 50 }, duration: 5 };
  }
}

describe('ToolRegistryService', () => {
  let service: ToolRegistryService;
  let salesTool: MockSalesTool;
  let inventoryTool: MockInventoryTool;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ToolRegistryService],
    }).compile();

    service = module.get<ToolRegistryService>(ToolRegistryService);
    salesTool = new MockSalesTool();
    inventoryTool = new MockInventoryTool();
  });

  it('should register a tool', () => {
    service.register(salesTool);
    expect(service.has('getSalesTotal')).toBe(true);
    expect(service.getCount()).toBe(1);
  });

  it('should get a tool by name', () => {
    service.register(salesTool);
    const tool = service.get('getSalesTotal');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('getSalesTotal');
  });

  it('should return undefined for unknown tool', () => {
    expect(service.get('unknown')).toBeUndefined();
  });

  it('should get all tools', () => {
    service.register(salesTool);
    service.register(inventoryTool);
    expect(service.getAll().length).toBe(2);
  });

  it('should find tools by category', () => {
    service.register(salesTool);
    service.register(inventoryTool);
    const salesTools = service.findByCategory('sales');
    expect(salesTools.length).toBe(1);
    expect(salesTools[0].name).toBe('getSalesTotal');
  });

  it('should search tools by name', () => {
    service.register(salesTool);
    const results = service.search('Sales');
    expect(results.length).toBe(1);
  });

  it('should search tools by description', () => {
    service.register(salesTool);
    const results = service.search('total sales');
    expect(results.length).toBe(1);
  });

  it('should get tool definitions', () => {
    service.register(salesTool);
    const defs = service.getToolDefinitions();
    expect(defs.length).toBe(1);
    expect(defs[0].name).toBe('getSalesTotal');
    expect(defs[0].permissions).toEqual(['sales:read']);
  });

  it('should get tool definition for a specific tool', () => {
    service.register(salesTool);
    const def = service.getToolDefinition('getSalesTotal');
    expect(def).toBeDefined();
    expect(def?.version).toBe('1.0.0');
  });

  it('should return undefined for missing tool definition', () => {
    expect(service.getToolDefinition('unknown')).toBeUndefined();
  });

  it('should remove a tool', () => {
    service.register(salesTool);
    expect(service.remove('getSalesTotal')).toBe(true);
    expect(service.has('getSalesTotal')).toBe(false);
  });

  it('should return false when removing nonexistent tool', () => {
    expect(service.remove('nonexistent')).toBe(false);
  });

  it('should get tool names', () => {
    service.register(salesTool);
    service.register(inventoryTool);
    const names = service.getToolNames();
    expect(names).toContain('getSalesTotal');
    expect(names).toContain('getStockLevel');
  });

  it('should get unique categories', () => {
    service.register(salesTool);
    service.register(inventoryTool);
    const cats = service.getCategories();
    expect(cats).toContain('sales');
    expect(cats).toContain('inventory');
  });

  it('should execute registered tool', async () => {
    service.register(salesTool);
    const tool = service.get('getSalesTotal')!;
    const result = await tool.execute(
      { customerId: 'cust-1' },
      { organizationId: 'org-1', userId: 'user-1', requestId: 'req-1' },
    );
    expect(result.success).toBe(true);
    expect((result.data as { total: number }).total).toBe(1000);
  });

  it('should warn on duplicate registration', () => {
    service.register(salesTool);
    service.register(salesTool);
    expect(service.getCount()).toBe(1);
  });
});
