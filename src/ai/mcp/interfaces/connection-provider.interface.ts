import { IMCPTransport } from './transport.interface';
import { IMCPAuthProvider } from './auth-provider.interface';
import { TransportOptions } from './transport.interface';

export interface ConnectionConfig {
  transportType: 'stdio' | 'http' | 'websocket';
  transportOptions: TransportOptions;
  auth?: {
    provider: string;
    credentials: Record<string, unknown>;
  };
  heartbeatInterval?: number;
  reconnectEnabled?: boolean;
  maxReconnectAttempts?: number;
}

export interface IMCPConnectionProvider {
  createTransport(config: ConnectionConfig): Promise<IMCPTransport>;
  createAuthProvider(type: string): IMCPAuthProvider;
}
