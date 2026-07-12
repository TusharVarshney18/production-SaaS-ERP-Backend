import { Injectable, Logger } from '@nestjs/common';
import { WorkflowAction } from '@prisma/client';
import { ActionHandler } from './action-handler.interface';
import { BusinessEventPayload } from '../events/business-events';

@Injectable()
export class NotificationActionService implements ActionHandler {
  readonly type = 'NOTIFICATION';
  private readonly logger = new Logger(NotificationActionService.name);

  async execute(
    action: WorkflowAction,
    _event: BusinessEventPayload,
  ): Promise<Record<string, unknown>> {
    const config = action.config as Record<string, unknown>;
    const title = config.title as string;
    const body = config.body as string;

    this.logger.log(`[NOTIFICATION] Title: ${title}, Body: ${body}`);

    return { created: true, title, body };
  }
}
