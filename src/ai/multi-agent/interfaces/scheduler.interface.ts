import { ExecutionContext } from '../../execution/execution-context';
import { TaskPriority } from './planner.interface';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';

export interface ScheduleOptions {
  priority: TaskPriority;
  delayMs?: number;
  timeout?: number;
  retryCount?: number;
  retryDelayMs?: number;
}

export interface ScheduledTask {
  id: string;
  name: string;
  agentName?: string;
  toolName?: string;
  input: unknown;
  options: ScheduleOptions;
  context: ExecutionContext;
  status: ExecutionStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
  retryAttempts: number;
}

export interface IExecutionScheduler {
  schedule(task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'retryAttempts'>): Promise<string>;
  cancel(taskId: string): Promise<boolean>;
  getStatus(taskId: string): ScheduledTask | undefined;
  listByOrganization(organizationId: string): ScheduledTask[];
  listByStatus(status: ExecutionStatus): ScheduledTask[];
  processNext(organizationId?: string): Promise<ScheduledTask | null>;
  getQueueSize(organizationId?: string): number;
}
