export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'delayed';
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export type JobType =
  | 'ai.chat'
  | 'agent.workflow'
  | 'rag.indexing'
  | 'rag.embedding'
  | 'rag.document-parse'
  | 'knowledge.sync'
  | 'mcp.tool-execution'
  | 'email.generation'
  | 'report.generation'
  | 'custom';

export interface JobOptions {
  priority: JobPriority;
  delayMs?: number;
  deduplicationKey?: string;
  ttl?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  timeout?: number;
  tags?: string[];
}

export interface JobDefinition {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  options: JobOptions;
  organizationId: string;
  userId: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  progress?: number;
  progressMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  metadata?: Record<string, unknown>;
}
