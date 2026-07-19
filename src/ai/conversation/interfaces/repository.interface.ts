import {
  Conversation,
  ConversationMessage,
  ConversationSummary,
  MemoryEntry,
  MemoryType,
} from './conversation.interface';

export interface IConversationRepository {
  createConversation(conversation: Conversation): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | null>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | null>;
  deleteConversation(id: string): Promise<boolean>;
  listConversations(
    organizationId: string,
    userId?: string,
    limit?: number,
    offset?: number,
  ): Promise<Conversation[]>;
  countConversations(organizationId: string, userId?: string): Promise<number>;
  addMessage(message: ConversationMessage): Promise<ConversationMessage>;
  getMessages(conversationId: string, limit?: number): Promise<ConversationMessage[]>;
  deleteMessages(conversationId: string): Promise<boolean>;
  countMessages(conversationId: string): Promise<number>;
  getTotalTokens(conversationId: string): Promise<number>;
  saveSummary(summary: ConversationSummary): Promise<ConversationSummary>;
  getSummary(conversationId: string): Promise<ConversationSummary | null>;
  deleteSummary(conversationId: string): Promise<boolean>;
}

export interface IMemoryRepository {
  saveMemory(entry: MemoryEntry): Promise<MemoryEntry>;
  getMemory(organizationId: string, key: string, userId?: string): Promise<MemoryEntry | null>;
  findMemories(
    organizationId: string,
    type?: MemoryType,
    userId?: string,
    tags?: string[],
  ): Promise<MemoryEntry[]>;
  updateMemory(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null>;
  deleteMemory(id: string): Promise<boolean>;
  deleteMemoriesByScope(organizationId: string, scope: string, userId?: string): Promise<number>;
}
