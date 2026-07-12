import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowDefinition, WorkflowAction, Prisma } from '@prisma/client';
import { BusinessEventPayload } from '../events/business-events';
import { ActionRegistryService } from '../actions/action-registry.service';
import { WorkflowDefinitionsService } from '../services/workflow-definitions.service';

interface WorkflowWithActions extends WorkflowDefinition {
  actions: WorkflowAction[];
}

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly definitions: WorkflowDefinitionsService,
    private readonly actionRegistry: ActionRegistryService,
  ) {}

  async processEvent(event: BusinessEventPayload): Promise<void> {
    const workflows = await this.definitions.findByEvent(event.organizationId, event.event);
    if (workflows.length === 0) {
      this.logger.debug(`No workflows found for event: ${event.event}`);
      return;
    }
    for (const workflow of workflows) {
      await this.executeWorkflow(workflow as WorkflowWithActions, event);
    }
  }

  private async executeWorkflow(
    workflow: WorkflowWithActions,
    event: BusinessEventPayload,
  ): Promise<void> {
    const executionLog = await this.prisma.workflowExecutionLog.create({
      data: {
        organizationId: event.organizationId,
        workflowDefinitionId: workflow.id,
        event: event.event,
        eventPayload: event as unknown as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    try {
      if (
        workflow.conditions &&
        !this.evaluateConditions(workflow.conditions as Record<string, unknown>, event)
      ) {
        await this.prisma.workflowExecutionLog.update({
          where: { id: executionLog.id },
          data: {
            status: 'SUCCESS',
            result: {
              skipped: true,
              reason: 'Conditions not met',
            } as unknown as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });
        return;
      }

      const actionResults: Record<string, unknown>[] = [];
      for (const action of workflow.actions) {
        const result = await this.actionRegistry.execute(action, event);
        actionResults.push({ actionId: action.id, type: action.type, result });
      }

      await this.prisma.workflowExecutionLog.update({
        where: { id: executionLog.id },
        data: {
          status: 'SUCCESS',
          result: { actionResults } as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Workflow "${workflow.name}" executed successfully for event ${event.event}`);
    } catch (error) {
      const errMsg = (error as Error).message;
      this.logger.error(`Workflow "${workflow.name}" failed: ${errMsg}`);
      await this.prisma.workflowExecutionLog.update({
        where: { id: executionLog.id },
        data: { status: 'FAILED', errorMessage: errMsg, completedAt: new Date() },
      });
    }
  }

  private evaluateConditions(
    conditions: Record<string, unknown>,
    event: BusinessEventPayload,
  ): boolean {
    const field = conditions.field as string;
    const operator = conditions.operator as string;
    const value = conditions.value;
    const eventFieldValue = this.getNestedValue(event as unknown as Record<string, unknown>, field);

    switch (operator) {
      case 'equals':
        return eventFieldValue === value;
      case 'not_equals':
        return eventFieldValue !== value;
      case 'contains':
        return String(eventFieldValue).includes(String(value));
      case 'greater_than':
        return Number(eventFieldValue) > Number(value);
      case 'less_than':
        return Number(eventFieldValue) < Number(value);
      case 'exists':
        return eventFieldValue !== undefined && eventFieldValue !== null;
      default:
        return true;
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, part: string) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
      return undefined;
    }, obj);
  }
}
