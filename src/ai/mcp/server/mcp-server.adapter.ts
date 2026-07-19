import { Injectable, Logger } from '@nestjs/common';
import { IMCPServer, ServerInfo } from '../interfaces/server.interface';
import { IMCPTransport } from '../interfaces/transport.interface';
import { IMCPAuthProvider, AuthCredentials } from '../interfaces/auth-provider.interface';
import { MCPToolDefinition } from '../dto/tool.dto';
import { MCPResourceDefinition } from '../dto/resource.dto';
import { MCPPromptDefinition } from '../dto/prompt.dto';
import { MCPRequest, MCPResponse } from '../dto/mcp-message.dto';
import { MCPError, MCPErrorCode } from '../interfaces/mcp-error.interface';

let requestCounter = 0;

@Injectable()
export class MCPServerAdapter implements IMCPServer {
  private transport: IMCPTransport | null = null;
  private authProvider: IMCPAuthProvider | null = null;
  private authCredentials: AuthCredentials | null = null;
  private connected_ = false;
  private readonly logger = new Logger(MCPServerAdapter.name);
  private readonly pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  constructor(
    public readonly info: ServerInfo,
    private readonly createTransport: () => IMCPTransport,
    private readonly getAuthProvider?: () => IMCPAuthProvider | null,
    private readonly getCredentials?: () => AuthCredentials | null,
  ) {}

  async connect(): Promise<void> {
    this.transport = this.createTransport();
    this.authProvider = this.getAuthProvider?.() || null;
    this.authCredentials = this.getCredentials?.() || null;

    this.transport.onMessage((msg) => this.handleResponse(msg as MCPResponse));
    this.transport.onError((err) =>
      this.logger.error(`Server "${this.info.name}" transport error: ${err.message}`),
    );
    this.transport.onClose(() => {
      this.connected_ = false;
      this.logger.warn(`Server "${this.info.name}" connection closed`);
    });

    await this.transport.connect();
    this.connected_ = true;

    if (this.authProvider && this.authCredentials) {
      const authResult = await this.authProvider.authenticate(this.authCredentials);
      if (!authResult.authenticated) {
        await this.disconnect();
        throw new MCPError(
          `Authentication failed for server "${this.info.name}": ${authResult.error}`,
          MCPErrorCode.AUTH_FAILED,
        );
      }
    }

    this.logger.log(`MCP server connected: ${this.info.name} v${this.info.version}`);
  }

  async disconnect(): Promise<void> {
    this.connected_ = false;
    for (const [, { reject }] of this.pending) {
      reject(new MCPError('Server disconnected', MCPErrorCode.CONNECTION_FAILED));
    }
    this.pending.clear();
    await this.transport?.disconnect();
    this.logger.log(`MCP server disconnected: ${this.info.name}`);
  }

  async listTools(): Promise<MCPToolDefinition[]> {
    const response = await this.sendRequest({ method: 'tools/list' });
    return (response as any)?.tools || [];
  }

  async listResources(): Promise<MCPResourceDefinition[]> {
    const response = await this.sendRequest({ method: 'resources/list' });
    return (response as any)?.resources || [];
  }

  async listPrompts(): Promise<MCPPromptDefinition[]> {
    const response = await this.sendRequest({ method: 'prompts/list' });
    return (response as any)?.prompts || [];
  }

  async executeTool(name: string, args: unknown): Promise<unknown> {
    return this.sendRequest({
      method: 'tools/call',
      params: { name, arguments: args },
    });
  }

  async readResource(uri: string): Promise<unknown> {
    return this.sendRequest({
      method: 'resources/read',
      params: { uri },
    });
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<unknown> {
    return this.sendRequest({
      method: 'prompts/get',
      params: { name, arguments: args },
    });
  }

  async health(): Promise<boolean> {
    try {
      await this.sendRequest({ method: 'ping' });
      return true;
    } catch {
      return false;
    }
  }

  private async sendRequest(request: Partial<MCPRequest>): Promise<unknown> {
    if (!this.connected_ || !this.transport) {
      throw new MCPError(
        `Server "${this.info.name}" is not connected`,
        MCPErrorCode.CONNECTION_FAILED,
      );
    }

    const id = `${request.method}-${++requestCounter}`;
    const msg: MCPRequest = {
      method: request.method!,
      params: request.params,
      id,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new MCPError('Request timed out', MCPErrorCode.TIMEOUT));
      }, 30000);

      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      this.transport!.send(msg).catch((err) => {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(err);
      });
    });
  }

  private handleResponse(response: MCPResponse): void {
    if (!response.id) return;
    const pending = this.pending.get(response.id);
    if (!pending) return;

    this.pending.delete(response.id);
    if (response.error) {
      pending.reject(
        new MCPError(`Server error: ${response.error.message}`, MCPErrorCode.SERVER_ERROR, 500, {
          code: response.error.code,
          data: response.error.data,
        }),
      );
    } else {
      pending.resolve(response.result);
    }
  }
}
