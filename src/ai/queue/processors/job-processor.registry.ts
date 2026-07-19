import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IJobProcessor } from '../interfaces/job-processor.interface';
import { JobDispatcher } from '../jobs/job-dispatcher.service';
import { DefaultJobProcessor } from './default-job.processor';
import { AgentWorkflowProcessor } from './agent-workflow.processor';
import { RagIndexingProcessor } from './rag-indexing.processor';
import { McpToolProcessor } from './mcp-tool.processor';

@Injectable()
export class JobProcessorRegistry implements OnModuleInit {
  private readonly logger = new Logger(JobProcessorRegistry.name);
  private readonly processors: IJobProcessor[] = [];

  constructor(
    private readonly defaultProcessor: DefaultJobProcessor,
    private readonly agentWorkflowProcessor: AgentWorkflowProcessor,
    private readonly ragIndexingProcessor: RagIndexingProcessor,
    private readonly mcpToolProcessor: McpToolProcessor,
  ) {
    this.processors.push(
      defaultProcessor,
      agentWorkflowProcessor,
      ragIndexingProcessor,
      mcpToolProcessor,
    );
  }

  onModuleInit() {
    for (const processor of this.processors) {
      this.logger.log(`Registered processor: ${processor.definition.jobType}`);
    }
  }

  registerAll(dispatcher: JobDispatcher): void {
    for (const processor of this.processors) {
      dispatcher.registerProcessor(processor);
    }
  }
}
