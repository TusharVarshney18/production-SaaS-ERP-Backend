import { Injectable, Logger } from '@nestjs/common';
import {
  IQueueProvider,
  QueueJob,
  QueueOptions,
  QueueStats,
} from '../interfaces/queue-provider.interface';
import { JobDefinition, JobResult } from '../dto/job.dto';
import { QueueError, QueueErrorCode } from '../interfaces/queue-error.interface';
import { generateId } from '../../constants';

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };

@Injectable()
export class InMemoryQueueProvider implements IQueueProvider {
  readonly name = 'in-memory';
  private readonly logger = new Logger(InMemoryQueueProvider.name);
  private readonly queue: QueueJob[] = [];
  private readonly delayed: Map<string, NodeJS.Timeout> = new Map();
  private readonly active = new Map<string, string>();
  private readonly results = new Map<string, JobResult>();
  private paused = false;
  private stats = {
    completed: 0,
    failed: 0,
    totalProcessingTime: 0,
    startTime: Date.now(),
  };

  async connect(): Promise<void> {
    this.logger.log('In-memory queue provider connected');
  }

  async disconnect(): Promise<void> {
    for (const [, timer] of this.delayed) clearTimeout(timer);
    this.delayed.clear();
    this.queue.length = 0;
    this.active.clear();
    this.logger.log('In-memory queue provider disconnected');
  }

  async enqueue(job: JobDefinition, options?: QueueOptions): Promise<string> {
    if (this.paused) throw new QueueError('Queue is paused', QueueErrorCode.QUEUE_PAUSED);
    if (this.queue.length >= 10000)
      throw new QueueError('Queue is full', QueueErrorCode.QUEUE_FULL);

    const queueJob: QueueJob = {
      job: { ...job, id: job.id || generateId('job') },
      enqueuedAt: new Date().toISOString(),
      status: 'queued',
    };

    if (!options?.fifo && options?.priority) {
      const idx = this.queue.findIndex(
        (q) => PRIORITY_ORDER[q.job.options.priority] > PRIORITY_ORDER[options.priority!],
      );
      if (idx >= 0) {
        this.queue.splice(idx, 0, queueJob);
      } else {
        this.queue.push(queueJob);
      }
    } else {
      this.queue.push(queueJob);
    }

    this.logger.debug(`Job enqueued: ${queueJob.job.id} (${job.type})`);
    return queueJob.job.id;
  }

  async dequeue(workerId: string, jobTypes?: string[]): Promise<QueueJob | null> {
    const idx = this.queue.findIndex((q) => {
      if (q.status !== 'queued') return false;
      if (jobTypes && jobTypes.length > 0 && !jobTypes.includes(q.job.type)) return false;
      return true;
    });

    if (idx < 0) return null;

    const [queueJob] = this.queue.splice(idx, 1);
    queueJob.status = 'processing';
    queueJob.startedAt = new Date().toISOString();
    this.active.set(queueJob.job.id, workerId);
    return queueJob;
  }

  async acknowledge(jobId: string, workerId: string): Promise<boolean> {
    if (this.active.get(jobId) !== workerId) return false;
    this.active.delete(jobId);
    this.stats.completed++;
    return true;
  }

  async fail(jobId: string, workerId: string, _error: string): Promise<boolean> {
    if (this.active.get(jobId) !== workerId) return false;
    this.active.delete(jobId);
    this.stats.failed++;
    return true;
  }

  async progress(_jobId: string, _percentage: number, _message?: string): Promise<void> {
    // progress is tracked externally via ProgressTracker
  }

  async schedule(job: JobDefinition, scheduledAt: string): Promise<string> {
    const delay = new Date(scheduledAt).getTime() - Date.now();
    if (delay <= 0) return this.enqueue(job);

    const id = job.id || generateId('job');
    const timer = setTimeout(async () => {
      this.delayed.delete(id);
      await this.enqueue({ ...job, id });
    }, delay);
    this.delayed.set(id, timer);
    this.logger.debug(`Job scheduled: ${id} at ${scheduledAt}`);
    return id;
  }

  async remove(jobId: string): Promise<boolean> {
    const idx = this.queue.findIndex((q) => q.job.id === jobId);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      return true;
    }
    const timer = this.delayed.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.delayed.delete(jobId);
      return true;
    }
    return false;
  }

  async getJob(jobId: string): Promise<QueueJob | null> {
    return this.queue.find((q) => q.job.id === jobId) || null;
  }

  async getStats(): Promise<QueueStats> {
    const activeJobs = this.active.size;
    const waitingJobs = this.queue.filter((q) => q.status === 'queued').length;
    const elapsed = (Date.now() - this.stats.startTime) / 60000;
    return {
      totalJobs: this.stats.completed + this.stats.failed + activeJobs + waitingJobs,
      activeJobs,
      waitingJobs,
      completedJobs: this.stats.completed,
      failedJobs: this.stats.failed,
      delayedJobs: this.delayed.size,
      averageProcessingTime:
        this.stats.completed > 0 ? this.stats.totalProcessingTime / this.stats.completed : 0,
      throughputPerMinute: elapsed > 0 ? (this.stats.completed + this.stats.failed) / elapsed : 0,
    };
  }

  async pause(): Promise<void> {
    this.paused = true;
    this.logger.log('Queue paused');
  }

  async resume(): Promise<void> {
    this.paused = false;
    this.logger.log('Queue resumed');
  }

  isPaused(): boolean {
    return this.paused;
  }
}
