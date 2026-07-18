import { JobDefinition, JobResult } from '../dto/job.dto';
import { ExecutionContext } from '../../execution/execution-context';

export interface JobProcessorDefinition {
  jobType: string;
  description: string;
  concurrency: number;
  timeout: number;
}

export interface IJobProcessor {
  readonly definition: JobProcessorDefinition;
  process(job: JobDefinition, context: ExecutionContext): Promise<JobResult>;
  validate?(job: JobDefinition): Promise<string[]>;
}
