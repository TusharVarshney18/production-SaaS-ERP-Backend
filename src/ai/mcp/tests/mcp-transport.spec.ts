import { MCPTransportFactory } from '../transport/mcp-transport.factory';
import { HttpTransport } from '../transport/http.transport';
import { StdioTransport } from '../transport/stdio.transport';

describe('MCPTransportFactory', () => {
  let factory: MCPTransportFactory;

  beforeEach(() => {
    factory = new MCPTransportFactory();
  });

  it('should create HTTP transport', () => {
    const transport = factory.createTransport('http', { url: 'http://localhost:8080' });
    expect(transport).toBeInstanceOf(HttpTransport);
    expect(transport.name).toBe('http');
  });

  it('should create STDIO transport', () => {
    const transport = factory.createTransport('stdio', { command: 'node', args: ['server.js'] });
    expect(transport).toBeInstanceOf(StdioTransport);
    expect(transport.name).toBe('stdio');
  });

  it('should throw for unsupported transport type', () => {
    expect(() => factory.createTransport('invalid' as any, {})).toThrow();
  });

  it('should list supported transports', () => {
    const supported = factory.getSupportedTransports();
    expect(supported).toContain('stdio');
    expect(supported).toContain('http');
    expect(supported).toContain('websocket');
  });
});

describe('HttpTransport', () => {
  it('should reject empty URL on connect', async () => {
    const transport = new HttpTransport({});
    await expect(transport.connect()).rejects.toThrow('requires a URL');
  });

  it('should have initial stats at zero', () => {
    const transport = new HttpTransport({ url: 'http://localhost:8080' });
    const stats = transport.getStats();
    expect(stats.bytesSent).toBe(0);
    expect(stats.bytesReceived).toBe(0);
    expect(stats.messagesSent).toBe(0);
    expect(stats.messagesReceived).toBe(0);
    expect(stats.reconnects).toBe(0);
  });
});

describe('StdioTransport', () => {
  it('should reject empty command on connect', async () => {
    const transport = new StdioTransport({});
    await expect(transport.connect()).rejects.toThrow('requires a command');
  });

  it('should register message handler', () => {
    const transport = new StdioTransport({ command: 'node' });
    transport.onMessage(() => {});
    expect(transport).toBeDefined();
  });
});
