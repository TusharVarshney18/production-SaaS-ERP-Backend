import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConversationRepository } from '../repositories/conversation.repository';
import { SessionMemoryService } from './session-memory.service';
import {
  Conversation,
  ConversationMessage,
  ConversationStatus,
} from '../interfaces/conversation.interface';
import { estimateTokens, generateId } from '../../constants';

@Injectable()
export class ConversationManagerService {
  private readonly logger = new Logger(ConversationManagerService.name);

  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly sessionMemory: SessionMemoryService,
  ) {}

  async startConversation(params: {
    organizationId: string;
    userId: string;
    title?: string;
    agentName?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: generateId('conv'),
      organizationId: params.organizationId,
      userId: params.userId,
      title: params.title || `Conversation ${new Date().toLocaleDateString()}`,
      status: 'active',
      agentName: params.agentName,
      messageCount: 0,
      totalTokens: 0,
      metadata: params.metadata,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.conversationRepository.createConversation(conversation);
    this.sessionMemory.createSession(saved.id, params.organizationId, params.userId);
    if (params.agentName) {
      this.sessionMemory.setCurrentAgent(params.organizationId, params.userId, params.agentName);
    }

    this.logger.log(
      `Conversation started: ${saved.id} (org: ${params.organizationId}, user: ${params.userId})`,
    );
    return saved;
  }

  async addMessage(params: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolName?: string;
    toolResult?: unknown;
    agentName?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ConversationMessage> {
    const conversation = await this.conversationRepository.getConversation(params.conversationId);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${params.conversationId} not found`);
    }
    if (conversation.status === 'ended') {
      throw new BadRequestException(`Conversation ${params.conversationId} has ended`);
    }

    const tokenCount = estimateTokens(params.content);
    const now = new Date().toISOString();

    const message: ConversationMessage = {
      id: generateId('msg'),
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      toolName: params.toolName,
      toolResult: params.toolResult,
      agentName: params.agentName,
      tokenCount,
      metadata: params.metadata,
      createdAt: now,
    };

    await this.conversationRepository.addMessage(message);

    await this.conversationRepository.updateConversation(params.conversationId, {
      messageCount: conversation.messageCount + 1,
      totalTokens: conversation.totalTokens + tokenCount,
      updatedAt: now,
      ...(params.agentName ? { agentName: params.agentName } : {}),
    });

    this.sessionMemory.pushMessage(conversation.organizationId, conversation.userId, message);
    this.sessionMemory.updateLastActivity(conversation.organizationId, conversation.userId);

    return message;
  }

  async endConversation(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.getConversation(conversationId);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const now = new Date().toISOString();
    const updated = await this.conversationRepository.updateConversation(conversationId, {
      status: 'ended' as ConversationStatus,
      updatedAt: now,
      endedAt: now,
    });

    this.sessionMemory.endSessionByConversation(conversationId);
    this.logger.log(`Conversation ended: ${conversationId}`);
    return updated!;
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.conversationRepository.getConversation(conversationId);
  }

  async getMessages(conversationId: string, limit?: number): Promise<ConversationMessage[]> {
    return this.conversationRepository.getMessages(conversationId, limit);
  }

  async listConversations(
    organizationId: string,
    userId?: string,
    limit?: number,
    offset?: number,
  ): Promise<Conversation[]> {
    return this.conversationRepository.listConversations(organizationId, userId, limit, offset);
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    await this.conversationRepository.deleteMessages(conversationId);
    await this.conversationRepository.deleteSummary(conversationId);
    this.sessionMemory.endSessionByConversation(conversationId);
    return this.conversationRepository.deleteConversation(conversationId);
  }
}
