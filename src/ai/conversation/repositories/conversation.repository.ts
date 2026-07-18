import { Injectable } from '@nestjs/common';
import {
  InMemoryConversationProvider,
  InMemoryMessageProvider,
  InMemorySummaryProvider,
} from '../providers/in-memory.provider';
import {
  Conversation,
  ConversationMessage,
  ConversationSummary,
} from '../interfaces/conversation.interface';

@Injectable()
export class ConversationRepository {
  constructor(
    private readonly conversationProvider: InMemoryConversationProvider,
    private readonly messageProvider: InMemoryMessageProvider,
    private readonly summaryProvider: InMemorySummaryProvider,
  ) {}

  async createConversation(conversation: Conversation): Promise<Conversation> {
    return this.conversationProvider.createConversation(conversation);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return this.conversationProvider.getConversation(id);
  }

  async updateConversation(
    id: string,
    updates: Partial<Conversation>,
  ): Promise<Conversation | null> {
    return this.conversationProvider.updateConversation(id, updates);
  }

  async deleteConversation(id: string): Promise<boolean> {
    return this.conversationProvider.deleteConversation(id);
  }

  async listConversations(
    organizationId: string,
    userId?: string,
    limit?: number,
    offset?: number,
  ): Promise<Conversation[]> {
    return this.conversationProvider.listConversations(organizationId, userId, limit, offset);
  }

  async countConversations(organizationId: string, userId?: string): Promise<number> {
    return this.conversationProvider.countConversations(organizationId, userId);
  }

  async addMessage(message: ConversationMessage): Promise<ConversationMessage> {
    return this.messageProvider.addMessage(message);
  }

  async getMessages(conversationId: string, limit?: number): Promise<ConversationMessage[]> {
    return this.messageProvider.getMessages(conversationId, limit);
  }

  async deleteMessages(conversationId: string): Promise<boolean> {
    return this.messageProvider.deleteMessages(conversationId);
  }

  async countMessages(conversationId: string): Promise<number> {
    return this.messageProvider.countMessages(conversationId);
  }

  async getTotalTokens(conversationId: string): Promise<number> {
    return this.messageProvider.getTotalTokens(conversationId);
  }

  async saveSummary(summary: ConversationSummary): Promise<ConversationSummary> {
    return this.summaryProvider.saveSummary(summary);
  }

  async getSummary(conversationId: string): Promise<ConversationSummary | null> {
    return this.summaryProvider.getSummary(conversationId);
  }

  async deleteSummary(conversationId: string): Promise<boolean> {
    return this.summaryProvider.deleteSummary(conversationId);
  }
}
