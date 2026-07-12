import { WorkflowAction } from '@prisma/client';
import { BusinessEventPayload } from '../events/business-events';

export interface ActionHandler {
  type: string;
  execute(action: WorkflowAction, event: BusinessEventPayload): Promise<Record<string, unknown>>;
}
