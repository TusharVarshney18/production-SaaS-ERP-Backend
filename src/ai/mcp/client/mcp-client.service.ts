import { Injectable, Logger } from '@nestjs/common';
import { IMCPClient } from '../interfaces/client.interface';
import { IMCPServer } from '../interfaces/server.interface';
import { MCPServerRegistry } from '../registry/mcp-server.registry';
import { MCPTransportFactory, TransportType } from '../transport/mcp-transport.factory';
import { MCPAuthProviderFactory } from '../authentication/mcp-auth-provider.factory';
import { MCPServerAdapter } from '../server/mcp-server.adapter';
import { AuthCredentials } from '../interfaces/auth-provider.interface';
import { MCPServerConfig } from '../dto/config.dto';
import { MCPError, MCPErrorCode } from '../interfaces/mcp-error.interface';

@Injectable()
export class MCPClientService implements IMCPClient {
  private readonly logger = new Logger(MCPClientService.name);
  private _connected = false;

  constructor(
    private readonly registry: MCPServerRegistry,
    private readonly transportFactory: MCPTransportFactory,
    private readonly authFactory: MCPAuthProviderFactory,
  ) {}

  get connected(): boolean {
    return this._connected;
  }

  async connect(serverId: string): Promise<void> {
    const registered = this.registry.getServer(serverId, '');
    if (!registered) {
      throw new MCPError(`Server "${serverId}" not found in registry`, MCPErrorCode.NOT_FOUND);
    }
    this._connected = true;
    this.logger.log(`MCP client connected to server: ${serverId}`);
  }

  async disconnect(serverId?: string): Promise<void> {
    if (serverId) {
      const registered = this.registry.getServer(serverId, '');
      if (registered) {
        await registered.server.disconnect();
      }
    } else {
      this._connected = false;
    }
    this.logger.log(`MCP client disconnected${serverId ? ` from ${serverId}` : ''}`);
  }

  async listTools(serverId: string): Promise<unknown> {
    const server = this.getServer(serverId);
    return server.listTools();
  }

  async listResources(serverId: string): Promise<unknown> {
    const server = this.getServer(serverId);
    return server.listResources();
  }

  async listPrompts(serverId: string): Promise<unknown> {
    const server = this.getServer(serverId);
    return server.listPrompts();
  }

  async executeTool(serverId: string, toolName: string, args: unknown): Promise<unknown> {
    const server = this.getServer(serverId);
    return server.executeTool(toolName, args);
  }

  async readResource(serverId: string, uri: string): Promise<unknown> {
    const server = this.getServer(serverId);
    return server.readResource(uri);
  }

  async getPrompt(serverId: string, name: string, args?: Record<string, string>): Promise<unknown> {
    const server = this.getServer(serverId);
    return server.getPrompt(name, args);
  }

  async health(serverId: string): Promise<boolean> {
    try {
      const server = this.getServer(serverId);
      return server.health();
    } catch {
      return false;
    }
  }

  getConnectedServers(): string[] {
    return this.registry.listServers('').map((s) => s.id);
  }

  async registerServer(config: MCPServerConfig): Promise<IMCPServer> {
    const transportType = config.transportType as TransportType;
    const createTransport = () =>
      this.transportFactory.createTransport(transportType, {
        url: config.transportOptions.url,
        command: config.transportOptions.command,
        args: config.transportOptions.args,
        timeout: config.transportOptions.timeout,
        headers: config.transportOptions.headers,
      });

    const getAuthProvider = config.auth
      ? () => {
          try {
            return this.authFactory.getProvider(config.auth!.type);
          } catch {
            return null;
          }
        }
      : undefined;

    const getCredentials = config.auth
      ? () =>
          ({
            type: config.auth!.type as AuthCredentials['type'],
            value: Object.values(config.auth!.credentials).join(':'),
          }) as AuthCredentials
      : undefined;

    const serverInfo = {
      name: config.name,
      version: config.version,
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
        streaming: false,
        logging: false,
      },
    };

    const server = new MCPServerAdapter(
      serverInfo,
      createTransport,
      getAuthProvider as any,
      getCredentials as any,
    );

    await server.connect();
    await this.registry.register(config.id, server, '', {
      ...config,
    });

    this.logger.log(`MCP server registered and connected: ${config.name} (${config.id})`);
    return server;
  }

  private getServer(serverId: string): IMCPServer {
    const registered = this.registry.getServer(serverId, '');
    if (!registered) {
      throw new MCPError(`MCP server "${serverId}" not registered`, MCPErrorCode.NOT_FOUND);
    }
    if (!registered.server) {
      throw new MCPError(`MCP server "${serverId}" not connected`, MCPErrorCode.CONNECTION_FAILED);
    }
    return registered.server;
  }
}
