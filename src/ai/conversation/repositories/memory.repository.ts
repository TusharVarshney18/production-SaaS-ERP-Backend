import { Injectable } from '@nestjs/common';
import { InMemoryMemoryStorageProvider } from '../providers/in-memory.provider';
import { MemoryEntry } from '../interfaces/conversation.interface';

@Injectable()
export class MemoryRepository {
  constructor(private readonly storageProvider: InMemoryMemoryStorageProvider) {}

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
    type?: string,
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
