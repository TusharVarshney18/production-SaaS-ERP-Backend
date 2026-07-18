import { JobDefinition, JobStatus, JobPriority } from '../dto/job.dto';

export interface QueueJob {
  job: JobDefinition;
  enqueuedAt: string;
  startedAt?: string;
  status: JobStatus;
}

export interface QueueOptions {
  fifo?: boolean;
  priority?: JobPriority;
  delayMs?: number;
  deduplicationKey?: string;
  ttl?: number;
}

export interface QueueStats {
  totalJobs: number;
  activeJobs: number;
  waitingJobs: number;
  completedJobs: number;
  failedJobs: number;
  delayedJobs: number;
  averageProcessingTime: number;
  throughputPerMinute: number;
}

export interface IQueueProvider {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  enqueue(job: JobDefinition, options?: QueueOptions): Promise<string>;
  dequeue(workerId: string, jobTypes?: string[]): Promise<QueueJob | null>;
  acknowledge(jobId: string, workerId: string): Promise<boolean>;
  fail(jobId: string, workerId: string, error: string): Promise<boolean>;
  progress(jobId: string, percentage: number, message?: string): Promise<void>;
  schedule(job: JobDefinition, scheduledAt: string): Promise<string>;
  remove(jobId: string): Promise<boolean>;
  getJob(jobId: string): Promise<QueueJob | null>;
  getStats(): Promise<QueueStats>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  isPaused(): boolean;
}
