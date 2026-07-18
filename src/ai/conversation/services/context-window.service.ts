import { Injectable, Logger } from '@nestjs/common';
import { ConversationMessage, MemoryEntry } from '../interfaces/conversation.interface';
import { SessionMemoryService } from './session-memory.service';
import { LongTermMemoryService } from './long-term-memory.service';
import { estimateTokens, DEFAULT_CONTEXT_LIMIT } from '../../constants';

export interface ContextWindow {
  messages: ConversationMessage[];
  totalTokens: number;
  maxTokens: number;
  trimmedCount: number;
  injectedMemoryCount: number;
  summaryInjected: boolean;
}

@Injectable()
export class ContextWindowService {
  private readonly logger = new Logger(ContextWindowService.name);

  constructor(
    private readonly sessionMemory: SessionMemoryService,
    private readonly longTermMemory: LongTermMemoryService,
  ) {}

  async buildContextWindow(
    conversationId: string,
    organizationId: string,
    userId: string,
    maxTokens?: number,
  ): Promise<ContextWindow> {
    const session = this.sessionMemory.getSession(organizationId, userId);
    const contextLimit = maxTokens || session?.maxContextTokens || DEFAULT_CONTEXT_LIMIT;

    let messages = this.sessionMemory.getLastMessages(organizationId, userId);
    let totalTokens = messages.reduce((sum, m) => sum + (m.tokenCount || 0), 0);
    let trimmedCount = 0;

    if (totalTokens > contextLimit) {
      const trimmed = this.trimMessages(messages, contextLimit);
      messages = trimmed.messages;
      totalTokens = trimmed.totalTokens;
      trimmedCount = trimmed.trimmedCount;
    }

    const relevantMemories = await this.longTermMemory.getRelevantMemories(organizationId, userId);
    const memoryMessages = this.buildMemoryMessages(relevantMemories);
    const injectedMemoryCount = memoryMessages.length;

    if (memoryMessages.length > 0) {
      const memoryTokens = memoryMessages.reduce((sum, m) => sum + (m.tokenCount || 0), 0);
      if (totalTokens + memoryTokens > contextLimit) {
        const trimmed = this.trimMessages(messages, contextLimit - memoryTokens);
        messages = trimmed.messages;
        totalTokens = trimmed.totalTokens;
        trimmedCount += trimmed.trimmedCount;
      }
      messages = [...memoryMessages, ...messages];
      totalTokens += memoryTokens;
    }

    const summaryInjected = memoryMessages.some((m) => m.metadata?.type === 'conversation_summary');

    return {
      messages,
      totalTokens,
      maxTokens: contextLimit,
      trimmedCount,
      injectedMemoryCount,
      summaryInjected,
    };
  }

  trimMessages(
    messages: ConversationMessage[],
    maxTokens: number,
  ): { messages: ConversationMessage[]; totalTokens: number; trimmedCount: number } {
    let trimmedCount = 0;

    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const systemTokens = systemMessages.reduce((sum, m) => sum + (m.tokenCount || 0), 0);
    let availableTokens = maxTokens - systemTokens;
    const trimmed: ConversationMessage[] = [...systemMessages];

    for (const msg of nonSystemMessages) {
      if ((msg.tokenCount || 0) <= availableTokens) {
        trimmed.push(msg);
        availableTokens -= msg.tokenCount || 0;
      } else {
        trimmedCount++;
      }
    }

    const totalTokens = trimmed.reduce((sum, m) => sum + (m.tokenCount || 0), 0);
    return { messages: trimmed, totalTokens, trimmedCount };
  }

  private buildMemoryMessages(memories: {
    user: MemoryEntry[];
    organization: MemoryEntry[];
  }): ConversationMessage[] {
    const messages: ConversationMessage[] = [];

    const orgPrefs = memories.organization.filter((m) => m.type === 'preferences');
    if (orgPrefs.length > 0) {
      messages.push({
        id: `mem-org-${Date.now()}`,
        conversationId: '',
        role: 'system',
        content: `Organization preferences: ${orgPrefs.map((p) => `${p.key}=${JSON.stringify(p.value)}`).join(', ')}`,
        tokenCount: 20,
        metadata: { type: 'organization_memory' },
        createdAt: new Date().toISOString(),
      });
    }

    const userPrefs = memories.user.filter((m) => m.type === 'preferences' || m.type === 'user');
    if (userPrefs.length > 0) {
      messages.push({
        id: `mem-user-${Date.now()}`,
        conversationId: '',
        role: 'system',
        content: `User preferences: ${userPrefs.map((p) => `${p.key}=${JSON.stringify(p.value)}`).join(', ')}`,
        tokenCount: 20,
        metadata: { type: 'user_memory' },
        createdAt: new Date().toISOString(),
      });
    }

    const summaries = memories.organization.filter((m) => m.type === 'conversation_summary');
    for (const summary of summaries) {
      messages.push({
        id: `mem-sum-${Date.now()}`,
        conversationId: '',
        role: 'system',
        content: `Previous conversation summary: ${JSON.stringify(summary.value)}`,
        tokenCount: estimateTokens(JSON.stringify(summary.value)),
        metadata: { type: 'conversation_summary' },
        createdAt: new Date().toISOString(),
      });
    }

    return messages;
  }
}
