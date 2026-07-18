import { Injectable, Inject } from '@nestjs/common';
import { IMemoryStorageProvider } from '../interfaces/memory-provider.interface';
import { MEMORY_STORAGE_PROVIDER_TOKEN } from '../providers/tokens';
import { MemoryEntry, MemoryType } from '../interfaces/conversation.interface';
import { IMemoryRepository } from '../interfaces/repository.interface';

@Injectable()
export class MemoryRepository implements IMemoryRepository {
  constructor(
    @Inject(MEMORY_STORAGE_PROVIDER_TOKEN)
    private readonly storageProvider: IMemoryStorageProvider,
  ) {}

  async saveMemory(entry: MemoryEntry): Promise<MemoryEntry> {
    return this.storageProvider.saveMemory(entry);
  }

  async getMemory(
    organizationId: string,
    key: string,
    userId?: string,
  ): Promise<MemoryEntry | null> {
    return this.storageProvider.getMemory(organizationId, key, userId);
  }

  async findMemories(
    organizationId: string,
    type?: MemoryType,
    userId?: string,
    tags?: string[],
  ): Promise<MemoryEntry[]> {
    return this.storageProvider.findMemories(organizationId, type, userId, tags);
  }

  async updateMemory(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
    return this.storageProvider.updateMemory(id, updates);
  }

  async deleteMemory(id: string): Promise<boolean> {
    return this.storageProvider.deleteMemory(id);
  }

  async deleteMemoriesByScope(
    organizationId: string,
    scope: string,
    userId?: string,
  ): Promise<number> {
    return this.storageProvider.deleteMemoriesByScope(organizationId, scope, userId);
  }
}
