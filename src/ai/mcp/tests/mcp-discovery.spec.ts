import { MCPDiscoveryService } from '../discovery/mcp-discovery.service';
import { MCPServerRegistry } from '../registry/mcp-server.registry';

describe('MCPDiscoveryService', () => {
  let registry: MCPServerRegistry;
  let discovery: MCPDiscoveryService;
  let mockServer: any;

  beforeEach(async () => {
    registry = new MCPServerRegistry();
    discovery = new MCPDiscoveryService(registry);
    mockServer = {
      info: {
        name: 'test-server',
        version: '2.0.0',
        capabilities: { tools: true, resources: true, prompts: false, streaming: false, logging: false },
      },
      connect: jest.fn(),
      disconnect: jest.fn(),
      listTools: jest.fn().mockResolvedValue([{ name: 't1', inputSchema: { type: 'object', properties: {} } }]),
      listResources: jest.fn().mockResolvedValue([{ uri: '/test', name: 'test' }]),
      listPrompts: jest.fn().mockResolvedValue([]),
      executeTool: jest.fn(),
      readResource: jest.fn(),
      getPrompt: jest.fn(),
      health: jest.fn(),
    };
    await registry.register('server-1', mockServer, 'org-1');
  });

  it('should discover a single server', async () => {
    const result = await discovery.discoverServer('server-1', 'org-1');
    expect(result.serverId).toBe('server-1');
    expect(result.toolCount).toBe(1);
    expect(result.resourceCount).toBe(1);
    expect(result.promptCount).toBe(0);
    expect(result.version).toBe('2.0.0');
    expect(result.capabilities).toContain('tools');
    expect(result.capabilities).toContain('resources');
  });

  it('should discover all servers', async () => {
    const results = await discovery.discoverAll('org-1');
    expect(results.length).toBe(1);
    expect(results[0].serverId).toBe('server-1');
  });

  it('should refresh discovery', async () => {
    const result = await discovery.refresh('server-1', 'org-1');
    expect(result.serverId).toBe('server-1');
  });

  it('should throw for non-existent server', async () => {
    await expect(discovery.discoverServer('nonexistent', 'org-1')).rejects.toThrow();
  });

  it('should get cache stats', () => {
    const stats = discovery.getCacheStats('org-1');
    expect(stats.cached).toBe(1);
  });
});
