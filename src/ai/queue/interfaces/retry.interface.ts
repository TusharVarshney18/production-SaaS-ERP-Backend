export type RetryStrategy = 'exponential' | 'linear' | 'fixed';

export interface RetryPolicy {
  strategy: RetryStrategy;
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryOnTimeout: boolean;
  retryOnError: boolean;
}

export interface IRetryManager {
  shouldRetry(jobId: string, attempt: number, error: string): Promise<boolean>;
  getDelay(jobId: string, attempt: number): Promise<number>;
  recordAttempt(jobId: string, attempt: number, error: string): Promise<void>;
  getRetryPolicy(jobType: string): RetryPolicy;
  setRetryPolicy(jobType: string, policy: RetryPolicy): void;
}
