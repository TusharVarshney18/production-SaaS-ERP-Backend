import { Injectable, Logger } from '@nestjs/common';
import { ISharedMemoryService, SharedMemoryEntry, SharedMemoryQuery } from '../interfaces/shared-memory.interface';
import { generateId } from '../../constants';

@Injectable()
export class SharedMemoryService implements ISharedMemoryService {
  private readonly logger = new Logger(SharedMemoryService.name);
  private readonly store = new Map<string, SharedMemoryEntry>();

  async set(
    key: string,
    value: unknown,
    params: {
      organizationId: string;
      workflowId?: string;
      scope?: 'organization' | 'workflow' | 'task';
      tags?: string[];
      ttl?: number;
      createdBy: string;
    },
  ): Promise<SharedMemoryEntry> {
    const entryKey = this.entryKey(params.organizationId, key, params.workflowId);
    const now = new Date().toISOString();
    const existing = this.store.get(entryKey);

    const entry: SharedMemoryEntry = {
      id: existing?.id || generateId('sm'),
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      key,
      value,
      scope: params.scope || 'workflow',
      tags: params.tags || [],
      ttl: params.ttl,
      createdBy: params.createdBy,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.store.set(entryKey, entry);
    this.logger.debug(`Shared memory set: ${key} (org: ${params.organizationId})`);
    return entry;
  }

  async get(organizationId: string, key: string, workflowId?: string): Promise<SharedMemoryEntry | undefined> {
    const entryKey = this.entryKey(organizationId, key, workflowId);
    const entry = this.store.get(entryKey);
    if (!entry) return undefined;
    if (entry.ttl && Date.now() - new Date(entry.updatedAt).getTime() > entry.ttl) {
      this.store.delete(entryKey);
      return undefined;
    }
    return entry;
  }

  async query(query: SharedMemoryQuery): Promise<SharedMemoryEntry[]> {
    const results: SharedMemoryEntry[] = [];
    for (const entry of this.store.values()) {
      if (entry.organizationId !== query.organizationId) continue;
      if (query.workflowId && entry.workflowId !== query.workflowId) continue;
      if (query.key && entry.key !== query.key) continue;
      if (query.scope && entry.scope !== query.scope) continue;
      if (query.tags && query.tags.length > 0) {
        if (!query.tags.some((t) => entry.tags.includes(t))) continue;
      }
      if (entry.ttl && Date.now() - new Date(entry.updatedAt).getTime() > entry.ttl) {
        this.store.delete(this.entryKey(entry.organizationId, entry.key, entry.workflowId));
        continue;
      }
      results.push(entry);
    }
    return results;
  }

  async delete(organizationId: string, key: string, workflowId?: string): Promise<boolean> {
    return this.store.delete(this.entryKey(organizationId, key, workflowId));
  }

  async clearWorkflowMemory(organizationId: string, workflowId: string): Promise<number> {
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.organizationId === organizationId && entry.workflowId === workflowId) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  async clearOrganizationMemory(organizationId: string): Promise<number> {
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.organizationId === organizationId) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  private entryKey(organizationId: string, key: string, workflowId?: string): string {
    return workflowId ? `${organizationId}:${workflowId}:${key}` : `${organizationId}:${key}`;
  }
}
