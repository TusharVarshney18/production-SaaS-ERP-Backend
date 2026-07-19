import { ApiKeyAuthProvider } from '../authentication/api-key.auth-provider';
import { BearerTokenAuthProvider } from '../authentication/bearer-token.auth-provider';
import { JwtAuthProvider } from '../authentication/jwt.auth-provider';
import { MCPAuthProviderFactory } from '../authentication/mcp-auth-provider.factory';

describe('ApiKeyAuthProvider', () => {
  let provider: ApiKeyAuthProvider;

  beforeEach(() => {
    provider = new ApiKeyAuthProvider();
    provider.registerApiKey('sk-test-key-123', { role: 'admin', orgId: 'org-1' });
  });

  it('should authenticate valid API key', async () => {
    const result = await provider.authenticate({ type: 'api-key', value: 'sk-test-key-123' });
    expect(result.authenticated).toBe(true);
    expect(result.identity).toEqual({ role: 'admin', orgId: 'org-1' });
  });

  it('should reject invalid API key', async () => {
    const result = await provider.authenticate({ type: 'api-key', value: 'invalid-key' });
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('Invalid API key');
  });

  it('should validate token', async () => {
    const result = await provider.validate('sk-test-key-123');
    expect(result.authenticated).toBe(true);
  });

  it('should revoke API key', async () => {
    expect(await provider.revoke('sk-test-key-123')).toBe(true);
    const result = await provider.authenticate({ type: 'api-key', value: 'sk-test-key-123' });
    expect(result.authenticated).toBe(false);
  });

  it('should reject refresh for API keys', async () => {
    const result = await provider.refresh('sk-test-key-123');
    expect(result.authenticated).toBe(false);
  });
});

describe('BearerTokenAuthProvider', () => {
  let provider: BearerTokenAuthProvider;

  beforeEach(() => {
    provider = new BearerTokenAuthProvider();
    provider.registerToken('valid-token', { user: 'test-user' });
    provider.registerToken('expired-token', { user: 'expired-user' }, -1);
  });

  it('should authenticate valid bearer token', async () => {
    const result = await provider.authenticate({ type: 'bearer', value: 'valid-token' });
    expect(result.authenticated).toBe(true);
    expect(result.identity).toEqual({ user: 'test-user' });
  });

  it('should reject invalid bearer token', async () => {
    const result = await provider.authenticate({ type: 'bearer', value: 'invalid' });
    expect(result.authenticated).toBe(false);
  });

  it('should reject expired token', async () => {
    const result = await provider.authenticate({ type: 'bearer', value: 'expired-token' });
    expect(result.authenticated).toBe(false);
  });

  it('should refresh token', async () => {
    const result = await provider.refresh('valid-token');
    expect(result.authenticated).toBe(true);
  });
});

describe('JwtAuthProvider', () => {
  let provider: JwtAuthProvider;

  beforeEach(() => {
    provider = new JwtAuthProvider();
  });

  it('should validate a valid JWT', async () => {
    const payload = Buffer.from(
      JSON.stringify({ sub: 'user-1', exp: Date.now() / 1000 + 3600 }),
    ).toString('base64url');
    const token = `header.${payload}.signature`;
    const result = await provider.validate(token);
    expect(result.authenticated).toBe(true);
    expect(result.identity).toBeDefined();
    expect(result.identity!.sub).toBe('user-1');
  });

  it('should reject invalid JWT format', async () => {
    const result = await provider.validate('invalid-token');
    expect(result.authenticated).toBe(false);
  });

  it('should reject expired JWT', async () => {
    const payload = Buffer.from(
      JSON.stringify({ sub: 'user-1', exp: Date.now() / 1000 - 3600 }),
    ).toString('base64url');
    const token = `header.${payload}.signature`;
    const result = await provider.validate(token);
    expect(result.authenticated).toBe(false);
  });

  it('should reject revoked tokens', async () => {
    const payload = Buffer.from(
      JSON.stringify({ sub: 'user-1', exp: Date.now() / 1000 + 3600 }),
    ).toString('base64url');
    const token = `header.${payload}.signature`;
    await provider.revoke(token);
    const result = await provider.validate(token);
    expect(result.authenticated).toBe(false);
  });
});

describe('MCPAuthProviderFactory', () => {
  let factory: MCPAuthProviderFactory;

  beforeEach(() => {
    factory = new MCPAuthProviderFactory(
      new ApiKeyAuthProvider(),
      new BearerTokenAuthProvider(),
      new JwtAuthProvider(),
    );
  });

  it('should return registered providers', () => {
    expect(factory.getProvider('api-key')).toBeDefined();
    expect(factory.getProvider('bearer')).toBeDefined();
    expect(factory.getProvider('jwt')).toBeDefined();
  });

  it('should throw for unknown provider', () => {
    expect(() => factory.getProvider('oauth2')).toThrow();
  });

  it('should list registered provider names', () => {
    const names = factory.getRegisteredProviders();
    expect(names).toContain('api-key');
    expect(names).toContain('bearer');
    expect(names).toContain('jwt');
  });
});
