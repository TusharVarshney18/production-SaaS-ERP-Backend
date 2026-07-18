import { ExecutionContext } from '../../execution/execution-context';

export type MessageType = 'request' | 'response' | 'broadcast' | 'event' | 'error';
export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

export interface AgentEnvelope {
  messageId: string;
  correlationId: string;
  type: MessageType;
  priority: MessagePriority;
  sourceAgent: string;
  targetAgent?: string;
  targetAgents?: string[];
  timestamp: string;
  ttl?: number;
}

export interface AgentMessage<T = unknown> {
  envelope: AgentEnvelope;
  payload: T;
  context: ExecutionContext;
}

export interface IAgentMessagingService {
  send<T>(message: AgentMessage<T>): Promise<void>;
  sendAndWait<T, R>(message: AgentMessage<T>, timeout?: number): Promise<R>;
  broadcast<T>(message: Omit<AgentMessage<T>, 'envelope'> & { targetAgents: string[] }): Promise<void>;
  publishEvent<T>(event: string, payload: T, context: ExecutionContext): Promise<void>;
  subscribe(event: string, handler: (message: AgentMessage) => Promise<void>): void;
  unsubscribe(event: string, handler: (message: AgentMessage) => Promise<void>): void;
  getPendingMessages(agentName: string): AgentMessage[];
  acknowledge(messageId: string): boolean;
}
