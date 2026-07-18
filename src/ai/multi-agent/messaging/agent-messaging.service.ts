import { Injectable, Logger } from '@nestjs/common';
import { IAgentMessagingService, AgentMessage, AgentEnvelope, MessageType, MessagePriority } from '../interfaces/messaging.interface';
import { ExecutionContext } from '../../execution/execution-context';
import { generateId } from '../../constants';
import { MCPError, MCPErrorCode } from '../../mcp/interfaces/mcp-error.interface';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

@Injectable()
export class AgentMessagingService implements IAgentMessagingService {
  private readonly logger = new Logger(AgentMessagingService.name);
  private readonly inboxes = new Map<string, AgentMessage[]>();
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly eventHandlers = new Map<string, Set<(message: AgentMessage) => Promise<void>>>();

  async send<T>(message: AgentMessage<T>): Promise<void> {
    const envelope: AgentEnvelope = {
      messageId: generateId('msg'),
      correlationId: message.envelope.correlationId || generateId('corr'),
      type: message.envelope.type || 'request',
      priority: message.envelope.priority || 'normal',
      sourceAgent: message.envelope.sourceAgent,
      targetAgent: message.envelope.targetAgent,
      timestamp: new Date().toISOString(),
      ttl: message.envelope.ttl,
    };

    const msg: AgentMessage = { ...message, envelope };

    if (message.envelope.targetAgent) {
      this.deliver(message.envelope.targetAgent, msg);
    }

    if (message.envelope.type === 'event' || message.envelope.type === 'broadcast') {
      this.dispatchEvent(msg);
    }

    this.logger.debug(
      `Message sent: ${envelope.messageId} (${envelope.type}) from ${envelope.sourceAgent}${envelope.targetAgent ? ` to ${envelope.targetAgent}` : ''}`,
    );
  }

  async sendAndWait<T, R>(message: AgentMessage<T>, timeout = 30000): Promise<R> {
    const correlationId = generateId('corr');
    const envelope: AgentEnvelope = {
      messageId: generateId('msg'),
      correlationId,
      type: 'request',
      priority: message.envelope.priority || 'normal',
      sourceAgent: message.envelope.sourceAgent,
      targetAgent: message.envelope.targetAgent,
      timestamp: new Date().toISOString(),
    };

    const msg: AgentMessage = { ...message, envelope };

    return new Promise<R>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new MCPError('Message response timeout', MCPErrorCode.TIMEOUT));
      }, timeout);

      this.pendingRequests.set(correlationId, { resolve: resolve as (v: unknown) => void, reject, timer });

      if (message.envelope.targetAgent) {
        this.deliver(message.envelope.targetAgent, msg);
      }
    });
  }

  async broadcast<T>(params: Omit<AgentMessage<T>, 'envelope'> & { targetAgents: string[] }): Promise<void> {
    const envelope: AgentEnvelope = {
      messageId: generateId('msg'),
      correlationId: generateId('corr'),
      type: 'broadcast',
      priority: 'normal',
      sourceAgent: params.context.metadata?.agentName as string || 'system',
      targetAgents: params.targetAgents,
      timestamp: new Date().toISOString(),
    };

    const msg: AgentMessage = { ...params, envelope } as AgentMessage;

    for (const target of params.targetAgents) {
      this.deliver(target, msg);
    }
  }

  async publishEvent<T>(event: string, payload: T, context: ExecutionContext): Promise<void> {
    const envelope: AgentEnvelope = {
      messageId: generateId('evt'),
      correlationId: generateId('corr'),
      type: 'event',
      priority: 'normal',
      sourceAgent: context.metadata?.agentName as string || 'system',
      timestamp: new Date().toISOString(),
    };

    const msg: AgentMessage = {
      envelope,
      payload: { event, payload } as unknown as T,
      context,
    };

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      await Promise.allSettled([...handlers].map((h) => h(msg)));
    }
  }

  subscribe(event: string, handler: (message: AgentMessage) => Promise<void>): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    this.logger.debug(`Handler subscribed to event: ${event}`);
  }

  unsubscribe(event: string, handler: (message: AgentMessage) => Promise<void>): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  getPendingMessages(agentName: string): AgentMessage[] {
    return this.inboxes.get(agentName) || [];
  }

  acknowledge(messageId: string): boolean {
    for (const [, messages] of this.inboxes) {
      const idx = messages.findIndex((m) => m.envelope.messageId === messageId);
      if (idx !== -1) {
        messages.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  private deliver(agentName: string, message: AgentMessage): void {
    if (!this.inboxes.has(agentName)) {
      this.inboxes.set(agentName, []);
    }
    this.inboxes.get(agentName)!.push(message);

    if (message.envelope.correlationId && this.pendingRequests.has(message.envelope.correlationId)) {
      const pending = this.pendingRequests.get(message.envelope.correlationId)!;
      clearTimeout(pending.timer);
      this.pendingRequests.delete(message.envelope.correlationId);
      pending.resolve(message.payload);
    }
  }

  private dispatchEvent(message: AgentMessage): void {
    const eventName = (message.payload as any)?.event as string;
    if (eventName && this.eventHandlers.has(eventName)) {
      const handlers = this.eventHandlers.get(eventName)!;
      handlers.forEach((h) => {
        h(message).catch((err) => this.logger.error(`Event handler error: ${err.message}`));
      });
    }
  }
}
