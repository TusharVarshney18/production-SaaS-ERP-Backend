export interface ProgressUpdate {
  jobId: string;
  percentage: number;
  message?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface JobProgress {
  jobId: string;
  percentage: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  message?: string;
  logs: string[];
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface IProgressTracker {
  track(jobId: string, percentage: number, message?: string): Promise<void>;
  getProgress(jobId: string): Promise<JobProgress | null>;
  log(jobId: string, message: string): Promise<void>;
  markStarted(jobId: string): Promise<void>;
  markCompleted(jobId: string, result?: unknown): Promise<void>;
  markFailed(jobId: string, error: string): Promise<void>;
  markCancelled(jobId: string): Promise<void>;
  getAllProgress(organizationId: string): Promise<JobProgress[]>;
}
