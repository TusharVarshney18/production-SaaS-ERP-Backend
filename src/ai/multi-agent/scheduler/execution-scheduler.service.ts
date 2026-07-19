import { Injectable, Logger } from '@nestjs/common';
import {
  IExecutionScheduler,
  ScheduledTask,
  ExecutionStatus,
} from '../interfaces/scheduler.interface';
import { generateId } from '../../constants';

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

@Injectable()
export class ExecutionScheduler implements IExecutionScheduler {
  private readonly logger = new Logger(ExecutionScheduler.name);
  private readonly tasks = new Map<string, ScheduledTask>();
  private readonly delayedTimers = new Map<string, NodeJS.Timeout>();

  async schedule(
    task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'retryAttempts'>,
  ): Promise<string> {
    const id = generateId('sched');
    const scheduled: ScheduledTask = {
      id,
      name: task.name,
      agentName: task.agentName,
      toolName: task.toolName,
      input: task.input,
      options: task.options,
      context: task.context,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryAttempts: 0,
    };

    if (task.options.delayMs && task.options.delayMs > 0) {
      scheduled.status = 'pending';
      this.tasks.set(id, scheduled);
      const timer = setTimeout(() => {
        const existing = this.tasks.get(id);
        if (existing && existing.status === 'pending') {
          existing.status = 'running';
          this.logger.debug(`Delayed task ready: ${id}`);
        }
      }, task.options.delayMs);
      this.delayedTimers.set(id, timer);
    } else {
      scheduled.status = 'running';
      this.tasks.set(id, scheduled);
    }

    this.logger.log(`Task scheduled: ${id} (${task.name})`);
    return id;
  }

  async cancel(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const timer = this.delayedTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.delayedTimers.delete(taskId);
    }

    task.status = 'cancelled';
    this.logger.log(`Task cancelled: ${taskId}`);
    return true;
  }

  getStatus(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  listByOrganization(organizationId: string): ScheduledTask[] {
    return [...this.tasks.values()].filter((t) => t.context.organizationId === organizationId);
  }

  listByStatus(status: ExecutionStatus): ScheduledTask[] {
    return [...this.tasks.values()].filter((t) => t.status === status);
  }

  async processNext(organizationId?: string): Promise<ScheduledTask | null> {
    const candidates = [...this.tasks.values()]
      .filter((t) => {
        if (t.status !== 'running' && t.status !== 'pending') return false;
        if (organizationId && t.context.organizationId !== organizationId) return false;
        return true;
      })
      .sort((a, b) => {
        const priorityA = PRIORITY_ORDER[a.options.priority] ?? 99;
        const priorityB = PRIORITY_ORDER[b.options.priority] ?? 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    return candidates[0] || null;
  }

  getQueueSize(organizationId?: string): number {
    const tasks = organizationId
      ? this.listByOrganization(organizationId)
      : [...this.tasks.values()];
    return tasks.filter((t) => t.status === 'pending' || t.status === 'running').length;
  }

  markCompleted(taskId: string, result: unknown): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.result = result;
    }
  }

  markFailed(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.retryAttempts++;
    if (task.options.retryCount && task.retryAttempts <= task.options.retryCount) {
      task.status = 'pending';
      const delay = task.options.retryDelayMs || 1000;
      const timer = setTimeout(() => {
        task.status = 'running';
      }, delay);
      this.delayedTimers.set(taskId, timer);
      this.logger.warn(
        `Task ${taskId} will retry (${task.retryAttempts}/${task.options.retryCount})`,
      );
    } else {
      task.status = 'failed';
      task.completedAt = new Date().toISOString();
      task.error = error;
      this.logger.error(`Task ${taskId} failed: ${error}`);
    }
  }
}
