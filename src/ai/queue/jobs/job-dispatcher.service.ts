import { Injectable, Logger } from '@nestjs/common';
import { IQueueProvider, QueueJob } from '../interfaces/queue-provider.interface';
import { IJobProcessor } from '../interfaces/job-processor.interface';
import { IRetryManager } from '../interfaces/retry.interface';
import { IDeadLetterManager } from '../interfaces/dead-letter.interface';
import { IProgressTracker } from '../interfaces/progress.interface';
import { IJobPersistence } from '../interfaces/persistence.interface';
import { WorkerManager } from '../workers/worker.manager';
import { QueueMetricsService } from '../metrics/queue-metrics.service';
import { JobDefinition, JobResult } from '../dto/job.dto';
import { ExecutionContext } from '../../execution/execution-context';
import { QueueError, QueueErrorCode } from '../interfaces/queue-error.interface';
import { generateId } from '../../constants';

@Injectable()
export class JobDispatcher {
  private readonly logger = new Logger(JobDispatcher.name);
  private readonly processors = new Map<string, IJobProcessor>();

  constructor(
    private readonly queueProvider: IQueueProvider,
    private readonly retryManager: IRetryManager,
    private readonly deadLetterManager: IDeadLetterManager,
    private readonly progressTracker: IProgressTracker,
    private readonly persistence: IJobPersistence,
    private readonly workerManager: WorkerManager,
    private readonly metrics: QueueMetricsService,
  ) {}

  registerProcessor(processor: IJobProcessor): void {
    this.processors.set(processor.definition.jobType, processor);
    this.logger.log(`Job processor registered: ${processor.definition.jobType}`);
  }

  getProcessor(jobType: string): IJobProcessor | undefined {
    return this.processors.get(jobType);
  }

  async dispatchJob(queueJob: QueueJob): Promise<JobResult> {
    const job = queueJob.job;
    const startTime = Date.now();

    await this.progressTracker.markStarted(job.id);
    await this.persistence.update(job.id, { status: 'processing', startedAt: new Date().toISOString() });

    const processor = this.processors.get(job.type);
    if (!processor) {
      return this.handleNoProcessor(job, startTime);
    }

    try {
      const context: ExecutionContext = {
        organizationId: job.organizationId,
        userId: job.userId,
        requestId: `job-${job.id}`,
        metadata: { jobType: job.type, ...job.metadata },
      };

      const result = await processor.process(job, context);
      const duration = Date.now() - startTime;

      await this.progressTracker.markCompleted(job.id, result.data);
      await this.persistence.update(job.id, { status: 'completed', completedAt: new Date().toISOString() });
      await this.persistence.saveResult(job.id, result.data);
      this.metrics.recordJob(job.type, duration, true);

      return result;
    } catch (error) {
      return this.handleProcessorError(job, error as Error, startTime);
    }
  }

  private async handleNoProcessor(job: JobDefinition, startTime: number): Promise<JobResult> {
    const error = `No processor registered for job type: ${job.type}`;
    this.logger.error(error);
    await this.progressTracker.markFailed(job.id, error);
    await this.persistence.update(job.id, { status: 'failed', error, completedAt: new Date().toISOString() });
    return { success: false, error, duration: Date.now() - startTime };
  }

  private async handleProcessorError(job: JobDefinition, error: Error, startTime: number): Promise<JobResult> {
    const errorMsg = error.message;
    const attempt = (job.attempts || 0) + 1;
    const duration = Date.now() - startTime;

    this.metrics.recordJob(job.type, duration, false);
    await this.retryManager.recordAttempt(job.id, attempt, errorMsg);

    const shouldRetry = await this.retryManager.shouldRetry(job.id, attempt, errorMsg);
    if (shouldRetry && attempt <= job.maxAttempts) {
      const delay = await this.retryManager.getDelay(job.id, attempt);
      this.logger.warn(`Job ${job.id} failed (attempt ${attempt}), retrying in ${delay}ms: ${errorMsg}`);
      await this.persistence.update(job.id, {
        status: 'queued',
        attempts: attempt,
        error: errorMsg,
      });
      return { success: false, error: errorMsg, duration, metadata: { retrying: true, delay, attempt } };
    }

    await this.deadLetterManager.moveToDlq(job, 'Max retries exceeded', errorMsg);
    await this.progressTracker.markFailed(job.id, errorMsg);
    await this.persistence.update(job.id, {
      status: 'failed',
      attempts: attempt,
      error: errorMsg,
      completedAt: new Date().toISOString(),
    });

    return { success: false, error: errorMsg, duration, metadata: { deadLettered: true, attempt } };
  }
}
