import { Injectable, Logger } from '@nestjs/common';
import { ITaskPlanner, TaskPlan, SubTask, TaskDecomposition } from '../interfaces/planner.interface';
import { AgentRequest } from '../../agents/interfaces/agent.interface';
import { AgentRegistryService } from '../../agents/registry/agent-registry.service';
import { generateId } from '../../constants';

@Injectable()
export class TaskPlannerService implements ITaskPlanner {
  private readonly logger = new Logger(TaskPlannerService.name);

  constructor(private readonly agentRegistry: AgentRegistryService) {}

  async decompose(request: AgentRequest, availableAgents: string[]): Promise<TaskPlan> {
    const text = request.text.toLowerCase();
    const subtasks: SubTask[] = [];
    const planId = generateId('plan');

    const researchAgents = availableAgents.filter((a) =>
      ['sales', 'finance', 'inventory', 'hr', 'reporting'].includes(a),
    );

    for (const agentName of researchAgents) {
      subtasks.push({
        id: generateId('task'),
        description: `Gather ${agentName} data for: ${request.text.substring(0, 100)}`,
        agentName,
        capability: this.getCapabilityForAgent(agentName),
        input: { query: request.text, agent: agentName },
        dependsOn: [],
        priority: 'normal',
        timeout: 15000,
        retryCount: 1,
      });
    }

    if (researchAgents.length > 1 && text.includes('compare') || text.includes('all') || text.includes('overview')) {
      const ceoSubtask: SubTask = {
        id: generateId('task'),
        description: `Synthesize findings from all agents: ${request.text.substring(0, 100)}`,
        agentName: 'ceo',
        capability: 'executive-overview',
        input: { query: request.text, agentReports: researchAgents },
        dependsOn: researchAgents.map((_, i) => subtasks[i]?.id).filter(Boolean),
        priority: 'high',
        timeout: 30000,
      };
      subtasks.push(ceoSubtask);
    }

    if (subtasks.length === 0) {
      subtasks.push({
        id: generateId('task'),
        description: request.text,
        agentName: availableAgents[0] || 'ceo',
        input: { query: request.text },
        dependsOn: [],
        priority: 'normal',
      });
    }

    const dependencyGraph = new Map<string, string[]>();
    for (const task of subtasks) {
      dependencyGraph.set(task.id, task.dependsOn);
    }

    const decomposition: TaskDecomposition = {
      subtasks,
      description: request.text.substring(0, 200),
    };

    this.logger.log(`Task plan created: ${planId} with ${subtasks.length} subtasks`);

    return {
      planId,
      request,
      decomposition,
      dependencyGraph,
      estimatedComplexity: this.estimateComplexity(subtasks),
    };
  }

  async validatePlan(plan: TaskPlan): Promise<string[]> {
    const errors: string[] = [];
    if (!plan.planId) errors.push('Plan must have a planId');
    if (!plan.decomposition.subtasks || plan.decomposition.subtasks.length === 0) {
      errors.push('Plan must have at least one subtask');
    }

    const taskIds = new Set(plan.decomposition.subtasks.map((t) => t.id));
    for (const task of plan.decomposition.subtasks) {
      for (const dep of task.dependsOn) {
        if (!taskIds.has(dep)) {
          errors.push(`Task "${task.id}" depends on unknown task "${dep}"`);
        }
      }
    }

    return errors;
  }

  getExecutionOrder(plan: TaskPlan): string[][] {
    const taskIds = plan.decomposition.subtasks.map((t) => t.id);
    const dependencyGraph = plan.dependencyGraph;
    const levels: string[][] = [];
    const visited = new Set<string>();

    const remaining = new Set(taskIds);
    while (remaining.size > 0) {
      const level: string[] = [];
      for (const taskId of remaining) {
        const deps = dependencyGraph.get(taskId) || [];
        if (deps.every((d) => !remaining.has(d))) {
          level.push(taskId);
        }
      }
      if (level.length === 0) {
        this.logger.warn('Circular dependency detected in task plan');
        level.push([...remaining][0]);
      }
      for (const id of level) {
        remaining.delete(id);
        visited.add(id);
      }
      levels.push(level);
    }

    return levels;
  }

  estimateComplexity(subtasks: SubTask[]): 'simple' | 'medium' | 'complex' {
    if (subtasks.length <= 2) return 'simple';
    if (subtasks.length <= 5) return 'medium';
    return 'complex';
  }

  private getCapabilityForAgent(agentName: string): string {
    const map: Record<string, string> = {
      ceo: 'executive-overview',
      sales: 'sales-analysis',
      finance: 'financial-analysis',
      inventory: 'inventory-analysis',
      hr: 'hr-analysis',
      reporting: 'report-generation',
    };
    return map[agentName] || 'general';
  }
}
