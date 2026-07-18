import { Injectable, Logger, Inject } from '@nestjs/common';
import { IQueueProvider, QueueJob, QueueStats } from './interfaces/queue-provider.interface';
import { IJobPersistence } from './interfaces/persistence.interface';
import { IRetryManager } from './interfaces/retry.interface';
import { IDeadLetterManager, DeadLetterEntry } from './interfaces/dead-letter.interface';
import { IProgressTracker, JobProgress } from './interfaces/progress.interface';
import { IJobScheduler, ScheduledJobConfig } from './interfaces/scheduler.interface';
import { JobDispatcher } from './jobs/job-dispatcher.service';
import { WorkerManager } from './workers/worker.manager';
import { QueueMetricsService } from './metrics/queue-metrics.service';
import { QUEUE_PROVIDER_TOKEN } from './queue.module';
import { JobDefinition, JobOptions, JobType, JobResult, JobStatus } from './dto/job.dto';
import { QueueConfig, QueueMetrics } from './dto/queue-config.dto';
import { QueueError, QueueErrorCode } from './interfaces/queue-error.interface';
import { generateId } from '../constants';
import { ExecutionContext } from '../execution/execution-context';

@Injectable()
export class QueueManagerService {
  private readonly logger = new Logger(QueueManagerService.name);
  private processing = false;

  constructor(
    @Inject(QUEUE_PROVIDER_TOKEN)
    private readonly queueProvider: IQueueProvider,
    private readonly persistence: IJobPersistence,
    private readonly retryManager: IRetryManager,
    private readonly deadLetterManager: IDeadLetterManager,
    private readonly progressTracker: IProgressTracker,
    private readonly scheduler: IJobScheduler,
    private readonly dispatcher: JobDispatcher,
    private readonly workerManager: WorkerManager,
    private readonly metrics: QueueMetricsService,
  ) {}

  async enqueue(params: {
    type: JobType;
    payload: Record<string, unknown>;
    organizationId: string;
    userId: string;
    options?: Partial<JobOptions>;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const id = generateId('job');
    const job: JobDefinition = {
      id,
      type: params.type,
      payload: params.payload,
      options: {
        priority: params.options?.priority || 'normal',
        maxRetries: params.options?.maxRetries || 3,
        retryDelayMs: params.options?.retryDelayMs || 1000,
        timeout: params.options?.timeout || 30000,
        tags: params.options?.tags,
      },
      organizationId: params.organizationId,
      userId: params.userId,
      status: 'queued',
      attempts: 0,
      maxAttempts: params.options?.maxRetries || 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: params.metadata,
    };

    await this.persistence.save(job);

    if (params.options?.delayMs && params.options.delayMs > 0) {
      const scheduledAt = new Date(Date.now() + params.options.delayMs).toISOString();
      await this.scheduler.schedule({
        id,
        name: `${params.type}-${id}`,
        jobType: params.type,
        payload: params.payload,
        startAt: scheduledAt,
        organizationId: params.organizationId,
        userId: params.userId,
      });
      await this.persistence.update(id, { status: 'delayed' });
      return id;
    }

    await this.queueProvider.enqueue(job, {
      priority: job.options.priority,
      fifo: true,
    });

    this.logger.log(`Job enqueued: ${id} (${params.type})`);
    return id;
  }

  async getJob(jobId: string): Promise<JobDefinition | null> {
    return this.persistence.get(jobId);
  }

  async getJobResult(jobId: string): Promise<unknown | null> {
    return this.persistence.getResult(jobId);
  }

  async getJobProgress(jobId: string): Promise<JobProgress | null> {
    return this.progressTracker.getProgress(jobId);
  }

  async listJobs(params: {
    organizationId?: string;
    status?: JobStatus;
    jobType?: string;
    limit?: number;
    offset?: number;
  }): Promise<JobDefinition[]> {
    return this.persistence.list({
      organizationId: params.organizationId,
      status: params.status,
      jobType: params.jobType,
      limit: params.limit,
      offset: params.offset,
    });
  }

  async cancelJob(jobId: string): Promise<boolean> {
    await this.queueProvider.remove(jobId);
    await this.persistence.update(jobId, { status: 'cancelled' });
    await this.progressTracker.markCancelled(jobId);
    return true;
  }

  async retryJob(jobId: string): Promise<string | null> {
    const job = await this.persistence.get(jobId);
    if (!job) return null;

    const retryJob: JobDefinition = {
      ...job,
      id: generateId('job'),
      status: 'queued',
      attempts: 0,
      error: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.persistence.save(retryJob);
    await this.queueProvider.enqueue(retryJob);
    return retryJob.id;
  }

  async getStats(): Promise<QueueMetrics> {
    const queueStats = await this.queueProvider.getStats();
    return this.metrics.getMetrics(
      queueStats.totalJobs,
      queueStats.activeJobs,
      queueStats.waitingJobs,
      queueStats.delayedJobs,
      this.workerManager.getWorkerCount(),
      this.workerManager.getIdleCount(),
    );
  }

  async getQueueStats(): Promise<QueueStats> {
    return this.queueProvider.getStats();
  }

  async listDLQ(jobType?: string): Promise<DeadLetterEntry[]> {
    return this.deadLetterManager.list(jobType);
  }

  async retryDLQ(entryId: string): Promise<string | null> {
    const newJobId = await this.deadLetterManager.retry(entryId);
    if (!newJobId) return null;
    const job = await this.persistence.get(newJobId);
    if (job) {
      await this.queueProvider.enqueue(job);
    }
    return newJobId;
  }

  async purgeDLQ(jobType?: string): Promise<number> {
    return this.deadLetterManager.purge(jobType);
  }

  async pause(): Promise<void> {
    await this.queueProvider.pause();
  }

  async resume(): Promise<void> {
    await this.queueProvider.resume();
  }

  async processNextJob(): Promise<boolean> {
    const queueJob = await this.queueProvider.dequeue('queue-manager');
    if (!queueJob) return false;

    try {
      this.processing = true;
      const result = await this.dispatcher.dispatchJob(queueJob);
      if (result.success) {
        await this.queueProvider.acknowledge(queueJob.job.id, 'queue-manager');
      } else if (result.metadata?.retrying) {
        const delay = result.metadata.delay as number;
        const scheduledAt = new Date(Date.now() + delay).toISOString();
        await this.queueProvider.schedule(queueJob.job, scheduledAt);
      } else {
        await this.queueProvider.fail(queueJob.job.id, 'queue-manager', result.error || 'Unknown error');
      }
      this.processing = false;
      return true;
    } catch (error) {
      this.processing = false;
      await this.queueProvider.fail(queueJob.job.id, 'queue-manager', (error as Error).message);
      return false;
    }
  }

  async processAllPending(): Promise<number> {
    let count = 0;
    while (await this.processNextJob()) {
      count++;
    }
    return count;
  }

  private async retryFailed(job: JobDefinition): Promise<void> {
    const delay = await this.retryManager.getDelay(job.id, job.attempts + 1);
    const scheduledAt = new Date(Date.now() + delay).toISOString();
    await this.queueProvider.schedule(job, scheduledAt);
  }
}
