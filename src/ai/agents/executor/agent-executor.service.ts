import { Injectable, Logger } from '@nestjs/common';
import { AgentRouterService } from '../router/agent-router.service';
import { AgentPlannerService } from '../planner/agent-planner.service';
import { ExecutionPipelineService } from '../../tools/execution/execution-pipeline.service';
import { PromptRegistryService } from '../../registry/prompt-registry.service';
import { AIGatewayService } from '../../core/ai-gateway.service';
import {
  AgentRequest,
  AgentResponse,
  AgentStepResult,
  AgentExecutionPlan,
} from '../interfaces/agent.interface';
import { ExecutionContext } from '../../execution/execution-context';

@Injectable()
export class AgentExecutorService {
  private readonly logger = new Logger(AgentExecutorService.name);

  constructor(
    private readonly agentRouter: AgentRouterService,
    private readonly agentPlanner: AgentPlannerService,
    private readonly executionPipeline: ExecutionPipelineService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly aiGateway: AIGatewayService,
  ) {}

  async execute(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    const requestId = request.context.requestId || `agent-${Date.now()}`;

    this.logger.log(
      `Agent execution started: "${request.text.substring(0, 100)}" for org ${request.context.organizationId}`,
    );

    try {
      const { agent, plan } = await this.agentRouter.route(request);

      const validationErrors = await this.agentPlanner.validatePlan(plan);
      if (validationErrors.length > 0) {
        return {
          success: false,
          agentName: agent.metadata.name,
          planId: plan.planId,
          results: [],
          summary: `Plan validation failed: ${validationErrors.join('; ')}`,
          duration: Date.now() - startTime,
          error: `Plan validation errors: ${validationErrors.join(', ')}`,
        };
      }

      const results = await this.executePlan(plan, request.context);

      const allSuccessful = results.every((r) => r.success);
      const summary = allSuccessful
        ? `Successfully completed ${results.length} step(s) via ${agent.metadata.name}`
        : `Completed ${results.filter((r) => r.success).length}/${results.length} steps with errors`;

      const duration = Date.now() - startTime;

      this.logger.log(
        `Agent execution completed: ${agent.metadata.name} - ${allSuccessful ? 'SUCCESS' : 'PARTIAL'} (${duration}ms)`,
      );

      return {
        success: allSuccessful,
        agentName: agent.metadata.name,
        planId: plan.planId,
        results,
        summary,
        duration,
        metadata: { requestId, toolCount: results.length },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Agent execution failed: ${error.message}`);

      return {
        success: false,
        agentName: 'unknown',
        planId: '',
        results: [],
        summary: `Execution failed: ${error.message}`,
        duration,
        error: error.message,
        metadata: { requestId },
      };
    }
  }

  private async executePlan(
    plan: AgentExecutionPlan,
    context: ExecutionContext,
  ): Promise<AgentStepResult[]> {
    const results: AgentStepResult[] = [];
    const completed = new Map<string, unknown>();

    for (const step of plan.steps) {
      const stepStart = Date.now();

      const depsMet = step.dependsOn.every((dep) => completed.has(dep));
      if (!depsMet) {
        results.push({
          stepId: step.stepId,
          toolName: step.toolName,
          success: false,
          data: null,
          error: `Dependencies not met: ${step.dependsOn.filter((d) => !completed.has(d)).join(', ')}`,
          duration: 0,
        });
        continue;
      }

      try {
        const pipelineResult = await this.executionPipeline.execute(
          step.toolName,
          step.input,
          context,
          step.timeout ? { executionTimeout: step.timeout } : undefined,
        );

        completed.set(step.stepId, pipelineResult.result);

        results.push({
          stepId: step.stepId,
          toolName: step.toolName,
          success: pipelineResult.success,
          data: pipelineResult.result,
          error: pipelineResult.error,
          duration: Date.now() - stepStart,
        });
      } catch (error) {
        results.push({
          stepId: step.stepId,
          toolName: step.toolName,
          success: false,
          data: null,
          error: error.message,
          duration: Date.now() - stepStart,
        });
      }
    }

    return results;
  }
}
