import { Injectable, Logger } from '@nestjs/common';
import { WorkflowAction } from '@prisma/client';
import { ActionHandler } from './action-handler.interface';
import { BusinessEventPayload } from '../events/business-events';

@Injectable()
export class WebhookActionService implements ActionHandler {
  readonly type = 'WEBHOOK';
  private readonly logger = new Logger(WebhookActionService.name);

  async execute(
    action: WorkflowAction,
    event: BusinessEventPayload,
  ): Promise<Record<string, unknown>> {
    const config = action.config as Record<string, unknown>;
    const url = config.url as string;
    const method = (config.method as string) || 'POST';

    this.logger.log(`[WEBHOOK] ${method} ${url} — Event: ${event.event}`);

    return { called: true, url, method, statusCode: 200 };
  }
}
