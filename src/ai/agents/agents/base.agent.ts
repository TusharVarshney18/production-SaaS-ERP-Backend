import { Logger } from '@nestjs/common';
import {
  IAgent,
  AgentMetadata,
  AgentCapability,
  AgentRequest,
  AgentExecutionPlan,
  AgentExecutionStep,
  AgentResponse,
  AgentStepResult,
} from '../interfaces/agent.interface';
import { PromptRegistryService } from '../../registry/prompt-registry.service';
import { ToolRegistryService } from '../../registry/tool-registry.service';
import { ExecutionPipelineService } from '../../tools/execution/execution-pipeline.service';
import { generateId } from '../../constants';

export abstract class BaseAgent implements IAgent {
  protected readonly logger: Logger;
  abstract readonly metadata: AgentMetadata;

  constructor(
    protected readonly promptRegistry: PromptRegistryService,
    protected readonly toolRegistry: ToolRegistryService,
    protected readonly executionPipeline: ExecutionPipelineService,
  ) {
    this.logger = new Logger((this.constructor as any).name || 'BaseAgent');
  }

  abstract canHandle(request: AgentRequest): Promise<AgentCapability | null>;
  abstract plan(request: AgentRequest): Promise<AgentExecutionPlan>;

  async validate(request: AgentRequest): Promise<string[]> {
    const errors: string[] = [];
    if (!request.text || request.text.trim().length === 0) {
      errors.push('Request text is required');
    }
    if (!request.context?.organizationId) {
      errors.push('Organization ID is required in context');
    }
    if (!request.context?.userId) {
      errors.push('User ID is required in context');
    }
    return errors;
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    const validationErrors = await this.validate(request);
    if (validationErrors.length > 0) {
      return {
        success: false,
        agentName: this.metadata.name,
        planId: '',
        results: [],
        summary: `Validation failed: ${validationErrors.join('; ')}`,
        duration: Date.now() - startTime,
        error: validationErrors.join(', '),
      };
    }

    const plan = await this.plan(request);
    const results: AgentStepResult[] = [];

    for (const step of plan.steps) {
      const stepStart = Date.now();
      try {
        const tool = this.toolRegistry.get(step.toolName);
        if (!tool) {
          results.push({
            stepId: step.stepId,
            toolName: step.toolName,
            success: false,
            data: null,
            error: `Tool "${step.toolName}" not found in registry`,
            duration: 0,
          });
          continue;
        }

        const pipelineResult = await this.executionPipeline.execute(
          step.toolName,
          step.input,
          request.context,
        );

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

    const allSuccessful = results.every((r) => r.success);
    return {
      success: allSuccessful,
      agentName: this.metadata.name,
      planId: plan.planId,
      results,
      summary: allSuccessful
        ? `${this.metadata.name}: Completed ${results.length} step(s) successfully`
        : `${this.metadata.name}: ${results.filter((r) => r.success).length}/${results.length} steps succeeded`,
      duration: Date.now() - startTime,
    };
  }

  protected createStep(
    toolName: string,
    input: unknown,
    description: string,
    dependsOn: string[] = [],
  ): AgentExecutionStep {
    return {
      stepId: generateId('step'),
      toolName,
      input,
      description,
      dependsOn,
    };
  }

  protected getPromptVariables(request: AgentRequest): Record<string, string> {
    return {
      organizationId: request.context.organizationId,
      userId: request.context.userId,
      request: request.text,
      ...(request.metadata as Record<string, string>),
    };
  }
}
