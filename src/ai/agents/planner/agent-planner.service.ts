import { Injectable, Logger } from '@nestjs/common';
import { PromptRegistryService } from '../../registry/prompt-registry.service';
import { ToolRegistryService } from '../../registry/tool-registry.service';
import {
  IAgent,
  AgentRequest,
  AgentExecutionPlan,
  AgentExecutionStep,
} from '../interfaces/agent.interface';

@Injectable()
export class AgentPlannerService {
  private readonly logger = new Logger(AgentPlannerService.name);

  constructor(
    private readonly promptRegistry: PromptRegistryService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  async createPlan(
    agent: IAgent,
    request: AgentRequest,
    toolInputs?: Record<string, unknown>,
  ): Promise<AgentExecutionPlan> {
    const plan = await agent.plan(request);
    if (toolInputs) {
      plan.steps = plan.steps.map((step) => ({
        ...step,
        input: toolInputs[step.toolName] ?? step.input,
      }));
    }
    return plan;
  }

  async validatePlan(plan: AgentExecutionPlan): Promise<string[]> {
    const errors: string[] = [];

    if (!plan.planId) errors.push('Plan must have a planId');
    if (!plan.agentName) errors.push('Plan must have an agentName');
    if (!plan.steps || plan.steps.length === 0) {
      errors.push('Plan must have at least one step');
      return errors;
    }

    for (const step of plan.steps) {
      if (!step.stepId) errors.push(`Step is missing stepId`);
      if (!step.toolName) errors.push(`Step ${step.stepId || '(unnamed)'} is missing toolName`);

      const tool = this.toolRegistry.get(step.toolName);
      if (!tool) {
        errors.push(`Step "${step.stepId}" references unknown tool "${step.toolName}"`);
      }
    }

    const stepIds = new Set(plan.steps.map((s) => s.stepId));
    for (const step of plan.steps) {
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!stepIds.has(dep)) {
            errors.push(`Step "${step.stepId}" depends on unknown step "${dep}"`);
          }
        }
      }
    }

    return errors;
  }

  estimateComplexity(steps: AgentExecutionStep[]): 'simple' | 'medium' | 'complex' {
    if (steps.length <= 1) return 'simple';
    if (steps.length <= 3) return 'medium';
    return 'complex';
  }

  private generatePlanId(): string {
    return `plan-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  }
}
