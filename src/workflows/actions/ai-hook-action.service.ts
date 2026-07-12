import { Injectable, Logger } from '@nestjs/common';
import { WorkflowAction } from '@prisma/client';
import { ActionHandler } from './action-handler.interface';
import { BusinessEventPayload } from '../events/business-events';

@Injectable()
export class AiHookActionService implements ActionHandler {
  readonly type = 'AI_HOOK';
  private readonly logger = new Logger(AiHookActionService.name);

  async execute(
    action: WorkflowAction,
    _event: BusinessEventPayload,
  ): Promise<Record<string, unknown>> {
    const config = action.config as Record<string, unknown>;
    const prompt = config.prompt as string;

    this.logger.log(`[AI_HOOK] Prompt: ${prompt} — AI integration not yet implemented`);

    return {
      hookTriggered: true,
      prompt,
      note: 'AI integration is a placeholder. Implement your AI service here.',
    };
  }
}
