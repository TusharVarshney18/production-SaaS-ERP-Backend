import { Injectable } from '@nestjs/common';
import {
  Conversation,
  ConversationMessage,
  ConversationSummary,
  MemoryEntry,
} from '../interfaces/conversation.interface';
import {
  IConversationProvider,
  IMessageProvider,
  ISummaryProvider,
  IMemoryStorageProvider,
} from '../interfaces/memory-provider.interface';

@Injectable()
export class InMemoryConversationProvider implements IConversationProvider {
  private readonly conversations = new Map<string, Conversation>();

  async createConversation(conversation: Conversation): Promise<Conversation> {
    this.conversations.set(conversation.id, { ...conversation });
    return conversation;
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) || null;
  }

  async updateConversation(
    id: string,
    updates: Partial<Conversation>,
  ): Promise<Conversation | null> {
    const existing = this.conversations.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.conversations.set(id, updated);
    return updated;
  }

  async deleteConversation(id: string): Promise<boolean> {
    return this.conversations.delete(id);
  }

  async listConversations(
    organizationId: string,
    userId?: string,
    limit = 50,
    offset = 0,
  ): Promise<Conversation[]> {
    const all = [...this.conversations.values()]
      .filter((c) => c.organizationId === organizationId && (!userId || c.userId === userId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return all.slice(offset, offset + limit);
  }

  async countConversations(organizationId: string, userId?: string): Promise<number> {
    return [...this.conversations.values()].filter(
      (c) => c.organizationId === organizationId && (!userId || c.userId === userId),
    ).length;
  }
}

@Injectable()
export class InMemoryMessageProvider implements IMessageProvider {
  private readonly messages = new Map<string, ConversationMessage[]>();

  async addMessage(message: ConversationMessage): Promise<ConversationMessage> {
    const existing = this.messages.get(message.conversationId) || [];
    existing.push(message);
    this.messages.set(message.conversationId, existing);
    return message;
  }

  async getMessages(
    conversationId: string,
    limit?: number,
    _beforeId?: string,
  ): Promise<ConversationMessage[]> {
    const msgs = this.messages.get(conversationId) || [];
    if (limit) return msgs.slice(-limit);
    return msgs;
  }

  async deleteMessages(conversationId: string): Promise<boolean> {
    return this.messages.delete(conversationId);
  }

  async countMessages(conversationId: string): Promise<number> {
    return (this.messages.get(conversationId) || []).length;
  }

  async getTotalTokens(conversationId: string): Promise<number> {
    const msgs = this.messages.get(conversationId) || [];
    return msgs.reduce((sum, m) => sum + (m.tokenCount || 0), 0);
  }
}

@Injectable()
export class InMemorySummaryProvider implements ISummaryProvider {
  private readonly summaries = new Map<string, ConversationSummary>();

  async saveSummary(summary: ConversationSummary): Promise<ConversationSummary> {
    this.summaries.set(summary.conversationId, summary);
    return summary;
  }

  async getSummary(conversationId: string): Promise<ConversationSummary | null> {
    return this.summaries.get(conversationId) || null;
  }

  async deleteSummary(conversationId: string): Promise<boolean> {
    return this.summaries.delete(conversationId);
  }
}

@Injectable()
export class InMemoryMemoryStorageProvider implements IMemoryStorageProvider {
  private readonly memories = new Map<string, MemoryEntry>();

  async saveMemory(entry: MemoryEntry): Promise<MemoryEntry> {
    this.memories.set(entry.id, { ...entry });
    return entry;
  }

  async getMemory(
    organizationId: string,
    key: string,
    userId?: string,
  ): Promise<MemoryEntry | null> {
    for (const entry of this.memories.values()) {
      if (entry.organizationId === organizationId && entry.key === key) {
        if (userId && entry.userId !== userId) continue;
        if (this.isExpired(entry)) {
          this.memories.delete(entry.id);
          continue;
        }
        return entry;
      }
    }
    return null;
  }

  async findMemories(
    organizationId: string,
    type?: string,
    userId?: string,
    tags?: string[],
  ): Promise<MemoryEntry[]> {
    return [...this.memories.values()].filter((entry) => {
      if (entry.organizationId !== organizationId) return false;
      if (type && entry.type !== type) return false;
      if (userId && entry.userId !== userId) return false;
      if (tags && tags.length > 0 && !tags.some((t) => entry.tags.includes(t))) return false;
      if (this.isExpired(entry)) {
        this.memories.delete(entry.id);
        return false;
      }
      return true;
    });
  }

  async updateMemory(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
    const existing = this.memories.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.memories.set(id, updated);
    return updated;
  }

  async deleteMemory(id: string): Promise<boolean> {
    return this.memories.delete(id);
  }

  async deleteMemoriesByScope(
    organizationId: string,
    scope: string,
    userId?: string,
  ): Promise<number> {
    let count = 0;
    for (const [id, entry] of this.memories.entries()) {
      if (entry.organizationId === organizationId && entry.scope === scope) {
        if (userId && entry.userId !== userId) continue;
        this.memories.delete(id);
        count++;
      }
    }
    return count;
  }

  private isExpired(entry: MemoryEntry): boolean {
    if (!entry.ttl) return false;
    const age = Date.now() - new Date(entry.updatedAt).getTime();
    return age > entry.ttl;
  }
}
