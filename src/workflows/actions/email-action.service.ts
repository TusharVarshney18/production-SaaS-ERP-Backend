import { Injectable, Logger } from '@nestjs/common';
import { WorkflowAction } from '@prisma/client';
import { ActionHandler } from './action-handler.interface';
import { BusinessEventPayload } from '../events/business-events';

@Injectable()
export class EmailActionService implements ActionHandler {
  readonly type = 'EMAIL';
  private readonly logger = new Logger(EmailActionService.name);

  async execute(
    action: WorkflowAction,
    event: BusinessEventPayload,
  ): Promise<Record<string, unknown>> {
    const config = action.config as Record<string, unknown>;
    const to = config.to as string;
    const subject = config.subject as string;
    const template = config.template as string;

    this.logger.log(
      `[EMAIL] To: ${to}, Subject: ${subject}, Template: ${template}, Event: ${event.event}`,
    );

    return { sent: true, to, subject, event: event.event };
  }
}
