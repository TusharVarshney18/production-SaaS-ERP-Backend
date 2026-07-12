import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowAction } from '@prisma/client';
import { ActionHandler } from './action-handler.interface';
import { BusinessEventPayload } from '../events/business-events';

@Injectable()
export class AuditActionService implements ActionHandler {
  readonly type = 'AUDIT';
  private readonly logger = new Logger(AuditActionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    action: WorkflowAction,
    event: BusinessEventPayload,
  ): Promise<Record<string, unknown>> {
    const config = action.config as Record<string, unknown>;

    await this.prisma.auditLog.create({
      data: {
        organizationId: event.organizationId,
        actorId: null,
        actorType: 'SYSTEM',
        event: `workflow.${event.event}`,
        resource: 'workflow',
        resourceId: event.resourceId,
        action: 'EXECUTE',
        details: { workflowAction: config, eventData: event.data } as never,
        requestId: `wf-${Date.now()}`,
        severity: 'INFO',
      },
    });

    return { logged: true };
  }
}
