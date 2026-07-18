export interface QueueConfig {
  maxQueueSize: number;
  defaultTimeout: number;
  defaultRetries: number;
  pollIntervalMs: number;
  enableMetrics: boolean;
}

export interface WorkerPoolConfig {
  minWorkers: number;
  maxWorkers: number;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  jobTimeout: number;
  maxRetries: number;
}

export interface QueueMetrics {
  totalJobs: number;
  activeJobs: number;
  waitingJobs: number;
  completedJobs: number;
  failedJobs: number;
  delayedJobs: number;
  deadLetteredJobs: number;
  averageProcessingTimeMs: number;
  throughputPerMinute: number;
  workerCount: number;
  idleWorkers: number;
  queueSize: number;
}
