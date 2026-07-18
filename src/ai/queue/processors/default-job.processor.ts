import { Injectable } from '@nestjs/common';
import { IJobProcessor, JobProcessorDefinition } from '../interfaces/job-processor.interface';
import { JobDefinition, JobResult } from '../dto/job.dto';
import { ExecutionContext } from '../../execution/execution-context';

@Injectable()
export class DefaultJobProcessor implements IJobProcessor {
  readonly definition: JobProcessorDefinition = {
    jobType: 'custom',
    description: 'Default processor for custom job types',
    concurrency: 5,
    timeout: 30000,
  };

  async process(job: JobDefinition, _context: ExecutionContext): Promise<JobResult> {
    const startTime = Date.now();
    return {
      success: true,
      data: { processed: true, payload: job.payload },
      duration: Date.now() - startTime,
    };
  }
}
