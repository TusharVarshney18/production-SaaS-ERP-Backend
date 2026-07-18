import { Injectable, Logger } from '@nestjs/common';
import { MemoryRepository } from '../repositories/memory.repository';
import { MemoryEntry, MemoryType } from '../interfaces/conversation.interface';

@Injectable()
export class LongTermMemoryService {
  private readonly logger = new Logger(LongTermMemoryService.name);

  constructor(private readonly memoryRepository: MemoryRepository) {}

  async saveMemory(params: {
    organizationId: string;
    userId?: string;
    type: MemoryType;
    key: string;
    value: unknown;
    scope: 'organization' | 'user';
    tags?: string[];
    ttl?: number;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryEntry> {
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: `mem-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      organizationId: params.organizationId,
      userId: params.scope === 'user' ? params.userId : undefined,
      type: params.type,
      key: params.key,
      value: params.value,
      scope: params.scope,
      tags: params.tags || [],
      ttl: params.ttl,
      metadata: params.metadata,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.memoryRepository.saveMemory(entry);
    this.logger.log(`Memory saved: ${saved.id} (${params.type}:${params.key})`);
    return saved;
  }

  async getMemory(
    organizationId: string,
    key: string,
    userId?: string,
  ): Promise<MemoryEntry | null> {
    return this.memoryRepository.getMemory(organizationId, key, userId);
  }

  async findUserMemories(
    organizationId: string,
    userId: string,
    type?: MemoryType,
  ): Promise<MemoryEntry[]> {
    return this.memoryRepository.findMemories(organizationId, type, userId);
  }

  async findOrganizationMemories(
    organizationId: string,
    type?: MemoryType,
  ): Promise<MemoryEntry[]> {
    return this.memoryRepository.findMemories(organizationId, type);
  }

  async findMemoriesByTags(
    organizationId: string,
    tags: string[],
    userId?: string,
  ): Promise<MemoryEntry[]> {
    return this.memoryRepository.findMemories(organizationId, undefined, userId, tags);
  }

  async updateMemory(
    id: string,
    value: unknown,
    metadata?: Record<string, unknown>,
  ): Promise<MemoryEntry | null> {
    const updates: Partial<MemoryEntry> = {
      value,
      updatedAt: new Date().toISOString(),
    };
    if (metadata) updates.metadata = metadata;
    return this.memoryRepository.updateMemory(id, updates);
  }

  async deleteMemory(id: string): Promise<boolean> {
    return this.memoryRepository.deleteMemory(id);
  }

  async clearUserMemories(organizationId: string, userId: string): Promise<number> {
    return this.memoryRepository.deleteMemoriesByScope(organizationId, 'user', userId);
  }

  async clearOrganizationMemories(organizationId: string): Promise<number> {
    return this.memoryRepository.deleteMemoriesByScope(organizationId, 'organization');
  }

  async getRelevantMemories(
    organizationId: string,
    userId: string,
  ): Promise<{ user: MemoryEntry[]; organization: MemoryEntry[] }> {
    const [user, organization] = await Promise.all([
      this.memoryRepository.findMemories(organizationId, undefined, userId),
      this.memoryRepository.findMemories(organizationId, undefined),
    ]);
    return {
      user: user.filter((m) => m.scope === 'user'),
      organization: organization.filter((m) => m.scope === 'organization'),
    };
  }
}
