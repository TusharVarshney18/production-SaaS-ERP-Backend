import { Injectable, Logger } from '@nestjs/common';
import { IJobProcessor, JobProcessorDefinition } from '../interfaces/job-processor.interface';
import { JobDefinition, JobResult } from '../dto/job.dto';
import { ExecutionContext } from '../../execution/execution-context';
import { AgentOrchestrator } from '../../multi-agent/orchestrator/agent-orchestrator.service';

@Injectable()
export class AgentWorkflowProcessor implements IJobProcessor {
  private readonly logger = new Logger(AgentWorkflowProcessor.name);
  readonly definition: JobProcessorDefinition = {
    jobType: 'agent.workflow',
    description: 'Executes multi-agent workflows',
    concurrency: 3,
    timeout: 120000,
  };

  constructor(private readonly orchestrator: AgentOrchestrator) {}

  async process(job: JobDefinition, context: ExecutionContext): Promise<JobResult> {
    const startTime = Date.now();
    const text = (job.payload.text || job.payload.query || '') as string;
    const agents = job.payload.agents as string[] | undefined;
    const workflowType = job.payload.workflowType as 'pipeline' | 'tree' | 'dag' | undefined;

    const result = agents
      ? await this.orchestrator.orchestrateWithAgents(
          { text, context, workflowType, metadata: job.metadata },
          agents,
        )
      : await this.orchestrator.orchestrate({
          text,
          context,
          workflowType,
          metadata: job.metadata,
        });

    return {
      success: result.success,
      data: result,
      error: result.error,
      duration: Date.now() - startTime,
    };
  }
}
