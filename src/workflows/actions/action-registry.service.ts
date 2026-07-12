import { Injectable, Logger } from '@nestjs/common';
import { WorkflowAction } from '@prisma/client';
import { ActionHandler } from './action-handler.interface';
import { BusinessEventPayload } from '../events/business-events';

@Injectable()
export class ActionRegistryService {
  private readonly logger = new Logger(ActionRegistryService.name);
  private handlers = new Map<string, ActionHandler>();

  register(handler: ActionHandler): void {
    this.handlers.set(handler.type, handler);
    this.logger.log(`Action handler registered: ${handler.type}`);
  }

  getHandler(type: string): ActionHandler | undefined {
    return this.handlers.get(type);
  }

  async execute(
    action: WorkflowAction,
    event: BusinessEventPayload,
  ): Promise<Record<string, unknown>> {
    const handler = this.handlers.get(action.type);
    if (!handler) {
      throw new Error(`No handler registered for action type: ${action.type}`);
    }
    return handler.execute(action, event);
  }
}
