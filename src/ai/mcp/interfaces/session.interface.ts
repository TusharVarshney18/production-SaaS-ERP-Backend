export interface SessionConfig {
  serverId: string;
  organizationId: string;
  userId?: string;
  heartbeatInterval?: number;
  timeout?: number;
  reconnectEnabled?: boolean;
  maxReconnectAttempts?: number;
}

export interface SessionInfo {
  sessionId: string;
  serverId: string;
  organizationId: string;
  userId?: string;
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
  connectedAt?: string;
  lastActivityAt?: string;
  error?: string;
  reconnectCount: number;
}

export interface IMCPSessionManager {
  createSession(config: SessionConfig): Promise<SessionInfo>;
  getSession(sessionId: string): SessionInfo | undefined;
  getSessionsByOrganization(organizationId: string): SessionInfo[];
  endSession(sessionId: string): Promise<boolean>;
  endAllSessions(organizationId: string): Promise<number>;
  sendHeartbeat(sessionId: string): Promise<boolean>;
  reconnect(sessionId: string): Promise<boolean>;
  getActiveSessionCount(): number;
}
