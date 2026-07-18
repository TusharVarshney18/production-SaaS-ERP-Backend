export interface MCPServerConfig {
  id: string;
  name: string;
  version: string;
  transportType: 'stdio' | 'http' | 'websocket';
  transportOptions: {
    url?: string;
    command?: string;
    args?: string[];
    timeout?: number;
    headers?: Record<string, string>;
  };
  auth?: {
    type: 'api-key' | 'bearer' | 'oauth2' | 'jwt' | 'mtls';
    credentials: Record<string, unknown>;
  };
  heartbeatInterval?: number;
  reconnectEnabled?: boolean;
  maxReconnectAttempts?: number;
  tags?: string[];
}

export interface MCPClientConfig {
  clientName: string;
  clientVersion: string;
  defaultTimeout: number;
  maxRetries: number;
  enableHeartbeat: boolean;
}

export enum MCPConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}
