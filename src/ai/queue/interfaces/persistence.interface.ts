import { JobDefinition, JobStatus } from '../dto/job.dto';

export interface PersistenceFilter {
  organizationId?: string;
  status?: JobStatus;
  jobType?: string;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
  offset?: number;
}

export interface IJobPersistence {
  save(job: JobDefinition): Promise<void>;
  get(jobId: string): Promise<JobDefinition | null>;
  update(jobId: string, updates: Partial<JobDefinition>): Promise<void>;
  delete(jobId: string): Promise<boolean>;
  list(filter: PersistenceFilter): Promise<JobDefinition[]>;
  count(filter: PersistenceFilter): Promise<number>;
  saveResult(jobId: string, result: unknown): Promise<void>;
  getResult(jobId: string): Promise<unknown | null>;
}
