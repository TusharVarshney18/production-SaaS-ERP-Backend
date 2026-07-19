import { MCPServerRegistry } from '../registry/mcp-server.registry';

describe('MCPServerRegistry', () => {
  let registry: MCPServerRegistry;
  let mockServer: any;

  beforeEach(() => {
    registry = new MCPServerRegistry();
    mockServer = {
      info: {
        name: 'test-server',
        version: '1.0.0',
        capabilities: {
          tools: true,
          resources: true,
          prompts: true,
          streaming: false,
          logging: false,
        },
      },
      connect: jest.fn(),
      disconnect: jest.fn(),
      listTools: jest.fn().mockResolvedValue([
        {
          name: 'tool1',
          description: 'Test tool 1',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'tool2',
          description: 'Test tool 2',
          inputSchema: { type: 'object', properties: {} },
        },
      ]),
      listResources: jest.fn().mockResolvedValue([{ uri: 'file:///test.txt', name: 'test.txt' }]),
      listPrompts: jest.fn().mockResolvedValue([{ name: 'prompt1', description: 'Test prompt' }]),
      executeTool: jest.fn(),
      readResource: jest.fn(),
      getPrompt: jest.fn(),
      health: jest.fn().mockResolvedValue(true),
    };
  });

  it('should register a server', async () => {
    await registry.register('server-1', mockServer, 'org-1');
    const server = registry.getServer('server-1', 'org-1');
    expect(server).toBeDefined();
    expect(server!.id).toBe('server-1');
    expect(server!.organizationId).toBe('org-1');
    expect(server!.enabled).toBe(true);
  });

  it('should list servers by organization', async () => {
    await registry.register('s1', mockServer, 'org-1');
    await registry.register('s2', mockServer, 'org-2');
    const org1Servers = registry.listServers('org-1');
    expect(org1Servers.length).toBe(1);
    expect(org1Servers[0].id).toBe('s1');
  });

  it('should unregister a server', async () => {
    await registry.register('s1', mockServer, 'org-1');
    expect(await registry.unregister('s1', 'org-1')).toBe(true);
    expect(registry.getServer('s1', 'org-1')).toBeUndefined();
  });

  it('should get tools from server', async () => {
    await registry.register('s1', mockServer, 'org-1');
    const tool = await registry.getTool('s1', 'tool1', 'org-1');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('tool1');
  });

  it('should get resources from server', async () => {
    await registry.register('s1', mockServer, 'org-1');
    const resource = await registry.getResource('s1', 'file:///test.txt', 'org-1');
    expect(resource).toBeDefined();
    expect(resource!.name).toBe('test.txt');
  });

  it('should get prompts from server', async () => {
    await registry.register('s1', mockServer, 'org-1');
    const prompt = await registry.getPrompt('s1', 'prompt1', 'org-1');
    expect(prompt).toBeDefined();
    expect(prompt!.name).toBe('prompt1');
  });

  it('should search tools by name', async () => {
    await registry.register('s1', mockServer, 'org-1');
    const results = await registry.searchTools('tool1', 'org-1');
    expect(results.length).toBe(1);
    expect(results[0].tool.name).toBe('tool1');
  });

  it('should get all tools', async () => {
    await registry.register('s1', mockServer, 'org-1');
    const allTools = await registry.getAllTools('org-1');
    expect(allTools.length).toBe(2);
  });

  it('should return empty for non-existent tool', async () => {
    await registry.register('s1', mockServer, 'org-1');
    const tool = await registry.getTool('s1', 'nonexistent', 'org-1');
    expect(tool).toBeUndefined();
  });

  it('should count servers by organization', async () => {
    await registry.register('s1', mockServer, 'org-1');
    await registry.register('s2', mockServer, 'org-1');
    expect(registry.getServerCount('org-1')).toBe(2);
    expect(registry.getServerCount('org-2')).toBe(0);
  });
});
