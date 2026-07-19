import { MCPSessionManager } from '../sessions/mcp-session.manager';
import { MCPServerRegistry } from '../registry/mcp-server.registry';

describe('MCPSessionManager', () => {
  let registry: MCPServerRegistry;
  let sessionManager: MCPSessionManager;
  let mockServer: any;

  beforeEach(async () => {
    registry = new MCPServerRegistry();
    sessionManager = new MCPSessionManager(registry);
    mockServer = {
      info: {
        name: 'test',
        version: '1.0.0',
        capabilities: {
          tools: true,
          resources: true,
          prompts: true,
          streaming: false,
          logging: false,
        },
      },
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      listTools: jest.fn().mockResolvedValue([]),
      listResources: jest.fn().mockResolvedValue([]),
      listPrompts: jest.fn().mockResolvedValue([]),
      executeTool: jest.fn(),
      readResource: jest.fn(),
      getPrompt: jest.fn(),
      health: jest.fn().mockResolvedValue(true),
    };
    await registry.register('server-1', mockServer, 'org-1');
  });

  it('should create a session', async () => {
    const session = await sessionManager.createSession({
      serverId: 'server-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(session.sessionId).toBeDefined();
    expect(session.serverId).toBe('server-1');
    expect(session.organizationId).toBe('org-1');
    expect(session.status).toBe('connected');
  });

  it('should throw for non-existent server', async () => {
    await expect(
      sessionManager.createSession({
        serverId: 'nonexistent',
        organizationId: 'org-1',
      }),
    ).rejects.toThrow();
  });

  it('should get session by id', async () => {
    const created = await sessionManager.createSession({
      serverId: 'server-1',
      organizationId: 'org-1',
    });
    const found = sessionManager.getSession(created.sessionId);
    expect(found).toBeDefined();
    expect(found!.sessionId).toBe(created.sessionId);
  });

  it('should list sessions by organization', async () => {
    await registry.register('server-1', mockServer, 'org-2');
    await sessionManager.createSession({ serverId: 'server-1', organizationId: 'org-1' });
    await sessionManager.createSession({ serverId: 'server-1', organizationId: 'org-2' });
    const org1Sessions = sessionManager.getSessionsByOrganization('org-1');
    expect(org1Sessions.length).toBe(1);
  });

  it('should end a session', async () => {
    const created = await sessionManager.createSession({
      serverId: 'server-1',
      organizationId: 'org-1',
    });
    expect(await sessionManager.endSession(created.sessionId)).toBe(true);
    expect(sessionManager.getSession(created.sessionId)).toBeUndefined();
  });

  it('should end all sessions for an organization', async () => {
    await sessionManager.createSession({ serverId: 'server-1', organizationId: 'org-1' });
    await sessionManager.createSession({ serverId: 'server-1', organizationId: 'org-1' });
    const count = await sessionManager.endAllSessions('org-1');
    expect(count).toBe(2);
  });

  it('should send heartbeat', async () => {
    const created = await sessionManager.createSession({
      serverId: 'server-1',
      organizationId: 'org-1',
    });
    const result = await sessionManager.sendHeartbeat(created.sessionId);
    expect(result).toBe(true);
  });

  it('should reconnect', async () => {
    const created = await sessionManager.createSession({
      serverId: 'server-1',
      organizationId: 'org-1',
    });
    const result = await sessionManager.reconnect(created.sessionId);
    expect(result).toBe(true);
    expect(mockServer.disconnect).toHaveBeenCalled();
    expect(mockServer.connect).toHaveBeenCalled();
  });

  it('should count active sessions', async () => {
    await sessionManager.createSession({ serverId: 'server-1', organizationId: 'org-1' });
    await sessionManager.createSession({ serverId: 'server-1', organizationId: 'org-1' });
    expect(sessionManager.getActiveSessionCount()).toBe(2);
  });
});
