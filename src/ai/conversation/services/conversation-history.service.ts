import { Injectable, Logger } from '@nestjs/common';
import { ConversationRepository } from '../repositories/conversation.repository';
import { ConversationMessage, ConversationSummary } from '../interfaces/conversation.interface';

export interface HistoryQuery {
  conversationId: string;
  limit?: number;
  includeToolCalls?: boolean;
  includeSystemMessages?: boolean;
}

@Injectable()
export class ConversationHistoryService {
  private readonly logger = new Logger(ConversationHistoryService.name);

  constructor(private readonly conversationRepository: ConversationRepository) {}

  async getHistory(query: HistoryQuery): Promise<ConversationMessage[]> {
    let messages = await this.conversationRepository.getMessages(query.conversationId, query.limit);

    if (query.includeToolCalls === false) {
      messages = messages.filter((m) => m.role !== 'tool');
    }
    if (query.includeSystemMessages === false) {
      messages = messages.filter((m) => m.role !== 'system');
    }

    return messages;
  }

  async getMessageCount(conversationId: string): Promise<number> {
    return this.conversationRepository.countMessages(conversationId);
  }

  async getTotalTokens(conversationId: string): Promise<number> {
    return this.conversationRepository.getTotalTokens(conversationId);
  }

  async getToolExecutionHistory(conversationId: string): Promise<ConversationMessage[]> {
    const messages = await this.conversationRepository.getMessages(conversationId);
    return messages.filter((m) => m.role === 'tool' || m.toolName !== undefined);
  }

  async getAgentSelectionHistory(
    conversationId: string,
  ): Promise<{ agentName: string; count: number }[]> {
    const messages = await this.conversationRepository.getMessages(conversationId);
    const agentCounts = new Map<string, number>();
    for (const msg of messages) {
      if (msg.agentName) {
        agentCounts.set(msg.agentName, (agentCounts.get(msg.agentName) || 0) + 1);
      }
    }
    return [...agentCounts.entries()]
      .map(([agentName, count]) => ({ agentName, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getErrorHistory(conversationId: string): Promise<ConversationMessage[]> {
    const messages = await this.conversationRepository.getMessages(conversationId);
    return messages.filter((m) => m.metadata?.error !== undefined);
  }

  async saveSummary(
    conversationId: string,
    summary: string,
    keyPoints: string[],
  ): Promise<ConversationSummary> {
    const summaryEntry: ConversationSummary = {
      conversationId,
      summary,
      keyPoints,
      tokenCount: Math.ceil(summary.length / 4),
      updatedAt: new Date().toISOString(),
    };
    return this.conversationRepository.saveSummary(summaryEntry);
  }

  async getSummary(conversationId: string): Promise<ConversationSummary | null> {
    return this.conversationRepository.getSummary(conversationId);
  }
}
