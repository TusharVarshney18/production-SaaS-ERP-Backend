export type ConversationStatus = 'active' | 'paused' | 'ended' | 'archived';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type MemoryType = 'user' | 'organization' | 'ai' | 'preferences' | 'conversation_summary';

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  toolName?: string;
  toolResult?: unknown;
  agentName?: string;
  tokenCount: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Conversation {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  status: ConversationStatus;
  agentName?: string;
  messageCount: number;
  totalTokens: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
}

export interface ConversationSummary {
  conversationId: string;
  summary: string;
  keyPoints: string[];
  tokenCount: number;
  updatedAt: string;
}

export interface SessionState {
  conversationId: string;
  organizationId: string;
  userId: string;
  lastMessages: ConversationMessage[];
  temporaryVariables: Map<string, unknown>;
  currentAgentName?: string;
  currentPlanId?: string;
  contextTokens: number;
  maxContextTokens: number;
  startedAt: string;
  lastActivityAt: string;
}

export interface MemoryEntry {
  id: string;
  organizationId: string;
  userId?: string;
  type: MemoryType;
  key: string;
  value: unknown;
  scope: 'organization' | 'user';
  tags: string[];
  ttl?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
