import { Injectable, Logger } from '@nestjs/common';
import { BusinessEventPayload } from './business-events';
import { WorkflowEngineService } from '../engine/workflow-engine.service';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly workflowEngine: WorkflowEngineService) {}

  async emit(payload: BusinessEventPayload): Promise<void> {
    this.logger.debug(`Event emitted: ${payload.event} (${payload.resourceId})`);

    try {
      await this.workflowEngine.processEvent(payload);
    } catch (error) {
      this.logger.error(`Error processing event ${payload.event}: ${(error as Error).message}`);
    }
  }
}
