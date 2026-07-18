import { Injectable, Logger } from '@nestjs/common';
import { SessionState, ConversationMessage } from '../interfaces/conversation.interface';

@Injectable()
export class SessionMemoryService {
  private readonly logger = new Logger(SessionMemoryService.name);
  private readonly sessions = new Map<string, SessionState>();
  private readonly defaultMaxTokens = 8192;

  createSession(
    conversationId: string,
    organizationId: string,
    userId: string,
    maxContextTokens?: number,
  ): SessionState {
    const session: SessionState = {
      conversationId,
      organizationId,
      userId,
      lastMessages: [],
      temporaryVariables: new Map(),
      contextTokens: 0,
      maxContextTokens: maxContextTokens || this.defaultMaxTokens,
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    const key = this.sessionKey(organizationId, userId);
    this.sessions.set(key, session);
    this.logger.log(`Session created: ${key}`);
    return session;
  }

  getSession(organizationId: string, userId: string): SessionState | undefined {
    return this.sessions.get(this.sessionKey(organizationId, userId));
  }

  getSessionByConversation(conversationId: string): SessionState | undefined {
    for (const session of this.sessions.values()) {
      if (session.conversationId === conversationId) return session;
    }
    return undefined;
  }

  updateLastActivity(organizationId: string, userId: string): void {
    const session = this.getSession(organizationId, userId);
    if (session) {
      session.lastActivityAt = new Date().toISOString();
    }
  }

  pushMessage(organizationId: string, userId: string, message: ConversationMessage): void {
    const session = this.getSession(organizationId, userId);
    if (!session) return;

    session.lastMessages.push(message);
    session.contextTokens += message.tokenCount;

    if (session.lastMessages.length > 50) {
      const removed = session.lastMessages.shift()!;
      session.contextTokens = Math.max(0, session.contextTokens - (removed.tokenCount || 0));
    }

    session.lastActivityAt = new Date().toISOString();
  }

  setTemporaryVariable(organizationId: string, userId: string, key: string, value: unknown): void {
    const session = this.getSession(organizationId, userId);
    if (session) {
      session.temporaryVariables.set(key, value);
    }
  }

  getTemporaryVariable(organizationId: string, userId: string, key: string): unknown {
    return this.getSession(organizationId, userId)?.temporaryVariables.get(key);
  }

  clearTemporaryVariables(organizationId: string, userId: string): void {
    const session = this.getSession(organizationId, userId);
    if (session) {
      session.temporaryVariables.clear();
    }
  }

  setCurrentAgent(organizationId: string, userId: string, agentName: string): void {
    const session = this.getSession(organizationId, userId);
    if (session) {
      session.currentAgentName = agentName;
    }
  }

  setCurrentPlan(organizationId: string, userId: string, planId: string): void {
    const session = this.getSession(organizationId, userId);
    if (session) {
      session.currentPlanId = planId;
    }
  }

  endSession(organizationId: string, userId: string): boolean {
    return this.sessions.delete(this.sessionKey(organizationId, userId));
  }

  endSessionByConversation(conversationId: string): boolean {
    const session = this.getSessionByConversation(conversationId);
    if (!session) return false;
    return this.endSession(session.organizationId, session.userId);
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  getLastMessages(organizationId: string, userId: string, count?: number): ConversationMessage[] {
    const session = this.getSession(organizationId, userId);
    if (!session) return [];
    return count ? session.lastMessages.slice(-count) : session.lastMessages;
  }

  private sessionKey(organizationId: string, userId: string): string {
    return `${organizationId}:${userId}`;
  }
}
