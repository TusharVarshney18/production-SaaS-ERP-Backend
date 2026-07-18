export interface WorkerConfig {
  workerId: string;
  name: string;
  jobTypes: string[];
  maxConcurrency: number;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  autoStart: boolean;
}

export interface WorkerStatus {
  workerId: string;
  status: 'idle' | 'processing' | 'paused' | 'stopped' | 'error';
  activeJobs: number;
  maxConcurrency: number;
  totalProcessed: number;
  totalFailed: number;
  uptime: number;
  lastHeartbeat: string;
  jobTypes: string[];
}

export interface WorkerHeartbeat {
  workerId: string;
  timestamp: string;
  status: WorkerStatus['status'];
  activeJobs: number;
  memoryUsage?: number;
}

export interface IWorker {
  readonly config: WorkerConfig;
  getStatus(): WorkerStatus;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  isRunning(): boolean;
}
