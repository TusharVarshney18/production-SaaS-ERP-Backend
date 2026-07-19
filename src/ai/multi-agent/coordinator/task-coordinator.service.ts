import { Injectable, Logger } from '@nestjs/common';
import {
  ITaskCoordinator,
  CoordinationRequest,
  CoordinationResult,
  SubTaskResult,
} from '../interfaces/coordinator.interface';
import { SubTask } from '../interfaces/planner.interface';
import { ExecutionContext } from '../../execution/execution-context';
import { AgentExecutorService } from '../../agents/executor/agent-executor.service';
import { TaskPlannerService } from '../planner/task-planner.service';
import { TaskDelegationService } from '../delegation/task-delegation.service';
import { SharedMemoryService } from '../shared-memory/shared-memory.service';

@Injectable()
export class TaskCoordinator implements ITaskCoordinator {
  private readonly logger = new Logger(TaskCoordinator.name);
  private readonly active = new Map<string, { planId: string; organizationId: string }>();

  constructor(
    private readonly planner: TaskPlannerService,
    private readonly agentExecutor: AgentExecutorService,
    private readonly delegation: TaskDelegationService,
    private readonly sharedMemory: SharedMemoryService,
  ) {}

  async coordinate(request: CoordinationRequest): Promise<CoordinationResult> {
    const startTime = Date.now();
    const plan = request.plan;
    const context = request.context;
    const planId = plan.planId;

    this.active.set(planId, { planId, organizationId: context.organizationId });

    const validationErrors = await this.planner.validatePlan(plan);
    if (validationErrors.length > 0) {
      return {
        success: false,
        planId,
        subtaskResults: [],
        duration: Date.now() - startTime,
        error: `Plan validation failed: ${validationErrors.join('; ')}`,
      };
    }

    const executionLevels = this.planner.getExecutionOrder(plan);
    const allResults: SubTaskResult[] = [];

    try {
      for (const level of executionLevels) {
        const levelResults = await Promise.all(
          level.map((taskId) => {
            const subtask = plan.decomposition.subtasks.find((t) => t.id === taskId);
            if (!subtask) return Promise.resolve(null as SubTaskResult | null);
            return this.executeSubtask(subtask, context);
          }),
        );

        for (const result of levelResults) {
          if (result) {
            allResults.push(result);
            await this.sharedMemory.set(`subtask:${result.subtaskId}`, result, {
              organizationId: context.organizationId,
              workflowId: planId,
              scope: 'task',
              tags: ['subtask', result.subtaskId],
              createdBy: result.agentName,
            });
          }
        }

        const levelFailed = levelResults.every((r) => r && !r.success);
        if (levelFailed) break;
      }

      this.active.delete(planId);

      const allSuccessful = allResults.every((r) => r.success);

      this.logger.log(
        `Coordination completed: ${planId} - ${allSuccessful ? 'SUCCESS' : 'PARTIAL'} (${Date.now() - startTime}ms)`,
      );

      return {
        success: allSuccessful,
        planId,
        subtaskResults: allResults,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.active.delete(planId);
      return {
        success: false,
        planId,
        subtaskResults: allResults,
        duration: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  async executeSubtask(subtask: SubTask, context: ExecutionContext): Promise<SubTaskResult> {
    const startTime = Date.now();
    this.logger.debug(`Executing subtask: ${subtask.id} (${subtask.description})`);

    try {
      const delegationResult = await this.delegation.delegate({
        taskDescription: subtask.description,
        requiredCapability: subtask.capability,
        preferredAgent: subtask.agentName,
        input: subtask.input,
        context,
        timeout: subtask.timeout,
        retryCount: subtask.retryCount || 0,
      });

      return {
        subtaskId: subtask.id,
        agentName: delegationResult.selectedAgent,
        success: delegationResult.success,
        data: delegationResult.agentResponse?.results,
        error: delegationResult.error,
        duration: Date.now() - startTime,
        agentResponse: delegationResult.agentResponse,
      };
    } catch (error) {
      return {
        subtaskId: subtask.id,
        agentName: subtask.agentName || 'unknown',
        success: false,
        data: null,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  async cancelCoordination(planId: string, _organizationId: string): Promise<boolean> {
    return this.active.delete(planId);
  }
}
