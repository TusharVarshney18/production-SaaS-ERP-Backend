import { Injectable } from '@nestjs/common';
import {
  IMCPConnectionProvider,
  ConnectionConfig,
} from '../interfaces/connection-provider.interface';
import { IMCPTransport } from '../interfaces/transport.interface';
import { IMCPAuthProvider } from '../interfaces/auth-provider.interface';
import { MCPTransportFactory, TransportType } from '../transport/mcp-transport.factory';
import { MCPAuthProviderFactory } from '../authentication/mcp-auth-provider.factory';

@Injectable()
export class MCPConnectionProvider implements IMCPConnectionProvider {
  constructor(
    private readonly transportFactory: MCPTransportFactory,
    private readonly authFactory: MCPAuthProviderFactory,
  ) {}

  async createTransport(config: ConnectionConfig): Promise<IMCPTransport> {
    return this.transportFactory.createTransport(
      config.transportType as TransportType,
      config.transportOptions,
    );
  }

  createAuthProvider(type: string): IMCPAuthProvider {
    return this.authFactory.getProvider(type);
  }
}
