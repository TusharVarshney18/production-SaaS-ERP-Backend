import { Injectable, Logger } from '@nestjs/common';
import { IWorkflowManager, WorkflowDefinition, WorkflowStep, WorkflowExecutionContext } from '../interfaces/workflow.interface';
import { ExecutionContext } from '../../execution/execution-context';
import { AgentExecutorService } from '../../agents/executor/agent-executor.service';
import { AgentRequest } from '../../agents/interfaces/agent.interface';
import { TaskDelegationService } from '../delegation/task-delegation.service';
import { SharedMemoryService } from '../shared-memory/shared-memory.service';
import { generateId } from '../../constants';

@Injectable()
export class WorkflowManager implements IWorkflowManager {
  private readonly logger = new Logger(WorkflowManager.name);
  private readonly workflows = new Map<string, WorkflowDefinition>();
  private readonly executions = new Map<string, WorkflowExecutionContext>();

  constructor(
    private readonly agentExecutor: AgentExecutorService,
    private readonly delegation: TaskDelegationService,
    private readonly sharedMemory: SharedMemoryService,
  ) {}

  async createWorkflow(definition: WorkflowDefinition): Promise<string> {
    const id = definition.id || generateId('wf');
    this.workflows.set(id, { ...definition, id });
    this.logger.log(`Workflow created: ${id} (${definition.name}, type: ${definition.type})`);
    return id;
  }

  async executeWorkflow(workflowId: string, context: ExecutionContext): Promise<boolean> {
    const definition = this.workflows.get(workflowId);
    if (!definition) {
      this.logger.error(`Workflow not found: ${workflowId}`);
      return false;
    }

    const executionCtx: WorkflowExecutionContext = {
      workflowId,
      organizationId: context.organizationId,
      userId: context.userId,
      requestId: context.requestId,
      startedAt: new Date().toISOString(),
      stepResults: new Map(),
      variables: new Map(),
      status: 'running',
    };

    this.executions.set(workflowId, executionCtx);

    try {
      const executionOrder = this.getExecutionOrder(definition);

      for (const level of executionOrder) {
        const promises = level.map((stepId) => {
          const step = definition.steps.find((s) => s.id === stepId);
          if (!step) return Promise.resolve(false);

          return this.executeStep(step, context, executionCtx);
        });

        const results = await Promise.all(promises);

        for (let i = 0; i < level.length; i++) {
          executionCtx.stepResults.set(level[i], results[i]);
        }

        const allFailed = results.every((r) => r === false);
        if (allFailed) {
          executionCtx.status = 'failed';
          return false;
        }
      }

      executionCtx.status = 'completed';
      this.logger.log(`Workflow completed: ${workflowId}`);
      return true;
    } catch (error) {
      executionCtx.status = 'failed';
      this.logger.error(`Workflow failed: ${workflowId} - ${(error as Error).message}`);
      return false;
    }
  }

  getWorkflowStatus(workflowId: string): WorkflowExecutionContext | undefined {
    return this.executions.get(workflowId);
  }

  async cancelWorkflow(workflowId: string, _organizationId: string): Promise<boolean> {
    const execution = this.executions.get(workflowId);
    if (!execution) return false;
    execution.status = 'cancelled';
    return true;
  }

  listWorkflows(organizationId: string): WorkflowExecutionContext[] {
    return [...this.executions.values()].filter((e) => e.organizationId === organizationId);
  }

  getExecutionOrder(definition: WorkflowDefinition): string[][] {
    const stepIds = definition.steps.map((s) => s.id);
    const levels: string[][] = [];
    const remaining = new Set(stepIds);

    if (definition.type === 'pipeline') {
      return stepIds.map((id) => [id]);
    }

    while (remaining.size > 0) {
      const level: string[] = [];
      for (const stepId of remaining) {
        const step = definition.steps.find((s) => s.id === stepId)!;
        const depsMet = step.dependsOn.every((d) => !remaining.has(d));
        if (depsMet) {
          level.push(stepId);
        }
      }
      if (level.length === 0) {
        level.push([...remaining][0]);
      }
      for (const id of level) remaining.delete(id);
      levels.push(level);
    }

    return levels;
  }

  private async executeStep(
    step: WorkflowStep,
    context: ExecutionContext,
    executionCtx: WorkflowExecutionContext,
  ): Promise<unknown> {
    try {
      this.logger.debug(`Executing step: ${step.name} (${step.id})`);

      const agentRequest: AgentRequest = {
        text: step.name,
        context,
        metadata: { ...step.input, workflowId: executionCtx.workflowId },
      };

      const response = await this.agentExecutor.execute(agentRequest);

      await this.sharedMemory.set(
        `step:${step.id}`,
        response,
        {
          organizationId: context.organizationId,
          workflowId: executionCtx.workflowId,
          scope: 'workflow',
          tags: ['workflow-step', step.id],
          createdBy: step.agentName || 'system',
        },
      );

      return response;
    } catch (error) {
      this.logger.error(`Step ${step.id} failed: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  }
}
