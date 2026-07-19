import { Injectable, Logger } from '@nestjs/common';
import { IMCPSessionManager, SessionInfo, SessionConfig } from '../interfaces/session.interface';
import { MCPServerRegistry } from '../registry/mcp-server.registry';
import { MCPError, MCPErrorCode } from '../interfaces/mcp-error.interface';
import { generateId } from '../../constants';

@Injectable()
export class MCPSessionManager implements IMCPSessionManager {
  private readonly logger = new Logger(MCPSessionManager.name);
  private readonly sessions = new Map<string, SessionInfo>();
  private readonly heartbeatTimers = new Map<string, NodeJS.Timeout>();
  private readonly timeoutTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly registry: MCPServerRegistry) {}

  async createSession(config: SessionConfig): Promise<SessionInfo> {
    const registered = this.registry.getServer(config.serverId, config.organizationId);
    if (!registered) {
      throw new MCPError(
        `MCP server "${config.serverId}" not registered for org ${config.organizationId}`,
        MCPErrorCode.NOT_FOUND,
      );
    }

    const sessionId = generateId('mcp-session');
    const now = new Date().toISOString();

    const session: SessionInfo = {
      sessionId,
      serverId: config.serverId,
      organizationId: config.organizationId,
      userId: config.userId,
      status: 'connecting',
      connectedAt: now,
      lastActivityAt: now,
      reconnectCount: 0,
    };

    try {
      await registered.server.connect();
      session.status = 'connected';
      this.sessions.set(sessionId, session);

      if (config.heartbeatInterval) {
        this.startHeartbeat(sessionId, config.heartbeatInterval);
      }
      if (config.timeout) {
        this.startTimeout(sessionId, config.timeout);
      }

      this.logger.log(
        `MCP session created: ${sessionId} (server: ${config.serverId}, org: ${config.organizationId})`,
      );
    } catch (error) {
      session.status = 'error';
      session.error = (error as Error).message;
      this.sessions.set(sessionId, session);
      this.logger.error(`MCP session creation failed: ${sessionId} - ${(error as Error).message}`);
    }

    return session;
  }

  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionsByOrganization(organizationId: string): SessionInfo[] {
    return [...this.sessions.values()].filter((s) => s.organizationId === organizationId);
  }

  async endSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.stopHeartbeat(sessionId);
    this.stopTimeout(sessionId);

    try {
      const registered = this.registry.getServer(session.serverId, session.organizationId);
      if (registered) {
        await registered.server.disconnect();
      }
    } catch (error) {
      this.logger.warn(
        `Error disconnecting server for session ${sessionId}: ${(error as Error).message}`,
      );
    }

    session.status = 'disconnected';
    this.logger.log(`MCP session ended: ${sessionId}`);
    return this.sessions.delete(sessionId);
  }

  async endAllSessions(organizationId: string): Promise<number> {
    const sessions = this.getSessionsByOrganization(organizationId);
    let count = 0;
    for (const session of sessions) {
      if (await this.endSession(session.sessionId)) {
        count++;
      }
    }
    return count;
  }

  async sendHeartbeat(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') return false;

    try {
      const registered = this.registry.getServer(session.serverId, session.organizationId);
      if (registered) {
        const alive = await registered.server.health();
        if (alive) {
          session.lastActivityAt = new Date().toISOString();
          return true;
        }
      }
      session.status = 'error';
      session.error = 'Heartbeat failed';
      return false;
    } catch {
      session.status = 'error';
      session.error = 'Heartbeat failed';
      return false;
    }
  }

  async reconnect(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'reconnecting';
    session.reconnectCount++;

    try {
      const registered = this.registry.getServer(session.serverId, session.organizationId);
      if (registered) {
        await registered.server.disconnect();
        await registered.server.connect();
        session.status = 'connected';
        session.lastActivityAt = new Date().toISOString();
        this.logger.log(`MCP session reconnected: ${sessionId}`);
        return true;
      }
    } catch (error) {
      session.status = 'error';
      session.error = (error as Error).message;
    }
    return false;
  }

  getActiveSessionCount(): number {
    return [...this.sessions.values()].filter((s) => s.status === 'connected').length;
  }

  private startHeartbeat(sessionId: string, intervalMs: number): void {
    const timer = setInterval(() => {
      this.sendHeartbeat(sessionId);
    }, intervalMs);
    this.heartbeatTimers.set(sessionId, timer);
  }

  private stopHeartbeat(sessionId: string): void {
    const timer = this.heartbeatTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(sessionId);
    }
  }

  private startTimeout(sessionId: string, timeoutMs: number): void {
    const timer = setTimeout(() => {
      const session = this.sessions.get(sessionId);
      if (session && session.status === 'connected') {
        this.logger.warn(`MCP session timed out: ${sessionId}`);
        this.endSession(sessionId);
      }
    }, timeoutMs);
    this.timeoutTimers.set(sessionId, timer);
  }

  private stopTimeout(sessionId: string): void {
    const timer = this.timeoutTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(sessionId);
    }
  }
}
