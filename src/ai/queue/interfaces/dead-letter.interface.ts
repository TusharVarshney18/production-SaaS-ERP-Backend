import { JobDefinition } from '../dto/job.dto';

export interface DeadLetterEntry {
  id: string;
  originalJob: JobDefinition;
  reason: string;
  error: string;
  attempts: number;
  failedAt: string;
  lastError: string;
}

export interface IDeadLetterManager {
  moveToDlq(job: JobDefinition, reason: string, error: string): Promise<string>;
  retry(entryId: string): Promise<string | null>;
  retryAll(jobType?: string): Promise<number>;
  purge(jobType?: string): Promise<number>;
  list(jobType?: string): Promise<DeadLetterEntry[]>;
  get(entryId: string): Promise<DeadLetterEntry | null>;
  getCount(): Promise<number>;
}
