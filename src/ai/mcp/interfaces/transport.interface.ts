export interface TransportOptions {
  url?: string;
  command?: string;
  args?: string[];
  timeout?: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface TransportStats {
  bytesSent: number;
  bytesReceived: number;
  messagesSent: number;
  messagesReceived: number;
  connectTime: number;
  lastActivity: number;
  reconnects: number;
}

export interface IMCPTransport {
  readonly name: string;
  readonly connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: unknown): Promise<void>;
  onMessage(handler: (message: unknown) => void): void;
  onError(handler: (error: Error) => void): void;
  onClose(handler: () => void): void;
  getStats(): TransportStats;
}
