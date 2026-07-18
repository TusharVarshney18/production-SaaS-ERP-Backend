import { Module, OnModuleInit } from '@nestjs/common';
import { InMemoryQueueProvider } from './providers/in-memory-queue.provider';
import { IQueueProvider } from './interfaces/queue-provider.interface';
import { JobPersistenceService } from './persistence/job-persistence.service';
import { RetryManager } from './retry/retry.manager';
import { DeadLetterManager } from './dead-letter/dead-letter.manager';
import { ProgressTracker } from './jobs/progress-tracker.service';
import { WorkerManager } from './workers/worker.manager';
import { JobDispatcher } from './jobs/job-dispatcher.service';
import { QueueMetricsService } from './metrics/queue-metrics.service';
import { JobSchedulerService } from './scheduler/job-scheduler.service';
import { DefaultJobProcessor } from './processors/default-job.processor';
import { AgentWorkflowProcessor } from './processors/agent-workflow.processor';
import { RagIndexingProcessor } from './processors/rag-indexing.processor';
import { McpToolProcessor } from './processors/mcp-tool.processor';
import { JobProcessorRegistry } from './processors/job-processor.registry';
import { QueueManagerService } from './queue-manager.service';

export const QUEUE_PROVIDER_TOKEN = 'QUEUE_PROVIDER';

@Module({
  providers: [
    {
      provide: QUEUE_PROVIDER_TOKEN,
      useClass: InMemoryQueueProvider,
    },
    JobPersistenceService,
    RetryManager,
    DeadLetterManager,
    ProgressTracker,
    WorkerManager,
    JobDispatcher,
    QueueMetricsService,
    JobSchedulerService,
    DefaultJobProcessor,
    AgentWorkflowProcessor,
    RagIndexingProcessor,
    McpToolProcessor,
    JobProcessorRegistry,
    QueueManagerService,
  ],
  exports: [
    QueueManagerService,
    JobDispatcher,
    WorkerManager,
    RetryManager,
    DeadLetterManager,
    ProgressTracker,
    QueueMetricsService,
    JobSchedulerService,
    JobPersistenceService,
  ],
})
export class QueueModule implements OnModuleInit {
  constructor(
    private readonly processorRegistry: JobProcessorRegistry,
    private readonly dispatcher: JobDispatcher,
    private readonly queueManager: QueueManagerService,
  ) {}

  onModuleInit() {
    this.processorRegistry.registerAll(this.dispatcher);
  }
}
