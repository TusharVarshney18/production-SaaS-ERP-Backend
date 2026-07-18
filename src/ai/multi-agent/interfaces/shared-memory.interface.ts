import { MemoryType } from '../../conversation/interfaces/conversation.interface';

export type SharedMemoryScope = 'organization' | 'workflow' | 'task';

export interface SharedMemoryEntry {
  id: string;
  organizationId: string;
  workflowId?: string;
  taskId?: string;
  key: string;
  value: unknown;
  scope: SharedMemoryScope;
  tags: string[];
  ttl?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SharedMemoryQuery {
  organizationId: string;
  workflowId?: string;
  key?: string;
  tags?: string[];
  scope?: SharedMemoryScope;
}

export interface ISharedMemoryService {
  set(key: string, value: unknown, params: { organizationId: string; workflowId?: string; scope?: SharedMemoryScope; tags?: string[]; ttl?: number; createdBy: string }): Promise<SharedMemoryEntry>;
  get(organizationId: string, key: string, workflowId?: string): Promise<SharedMemoryEntry | undefined>;
  query(query: SharedMemoryQuery): Promise<SharedMemoryEntry[]>;
  delete(organizationId: string, key: string, workflowId?: string): Promise<boolean>;
  clearWorkflowMemory(organizationId: string, workflowId: string): Promise<number>;
  clearOrganizationMemory(organizationId: string): Promise<number>;
}
