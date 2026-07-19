import { MCPAuthorizationService } from '../authorization/mcp-authorization.service';

describe('MCPAuthorizationService', () => {
  let auth: MCPAuthorizationService;

  beforeEach(() => {
    auth = new MCPAuthorizationService();
  });

  it('should allow tools by default when no allow-list is set', () => {
    expect(auth.isToolAllowed('server-1', 'any-tool', 'org-1')).toBe(true);
  });

  it('should allow tools in allow-list', () => {
    auth.setToolAllowList('org-1', [
      { serverId: 'server-1', toolName: 'allowed-tool', allowed: true },
      { serverId: 'server-1', toolName: 'blocked-tool', allowed: false },
    ]);
    expect(auth.isToolAllowed('server-1', 'allowed-tool', 'org-1')).toBe(true);
    expect(auth.isToolAllowed('server-1', 'blocked-tool', 'org-1')).toBe(false);
  });

  it('should enforce tool access', async () => {
    auth.setToolAllowList('org-1', [
      { serverId: 'server-1', toolName: 'ok', allowed: true },
      { serverId: 'server-1', toolName: 'nope', allowed: false },
    ]);
    const context = { organizationId: 'org-1', userId: 'user-1', requestId: 'r1' } as any;
    await expect(auth.enforceToolAccess('server-1', 'ok', context)).resolves.toBeUndefined();
    await expect(auth.enforceToolAccess('server-1', 'nope', context)).rejects.toThrow(
      'not allowed',
    );
  });

  it('should validate input size', () => {
    expect(() => auth.validateInputSize('small')).not.toThrow();
    expect(() => auth.validateInputSize('x'.repeat(10))).not.toThrow();
    expect(() => auth.validateInputSize({ data: 'x'.repeat(500) })).not.toThrow();
  });

  it('should reject oversized input', () => {
    const large = { data: 'x'.repeat(2 * 1024 * 1024) };
    expect(() => auth.validateInputSize(large, 1024)).toThrow('exceeds maximum');
  });
});
