import { AgentRequest } from '../../agents/interfaces/agent.interface';

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';
export type TaskDependency = 'sequential' | 'parallel';

export interface SubTask {
  id: string;
  description: string;
  agentName?: string;
  capability?: string;
  input: Record<string, unknown>;
  dependsOn: string[];
  priority: TaskPriority;
  timeout?: number;
  retryCount?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskDecomposition {
  subtasks: SubTask[];
  description: string;
}

export interface TaskPlan {
  planId: string;
  request: AgentRequest;
  decomposition: TaskDecomposition;
  dependencyGraph: Map<string, string[]>;
  estimatedComplexity: 'simple' | 'medium' | 'complex';
  metadata?: Record<string, unknown>;
}

export interface ITaskPlanner {
  decompose(request: AgentRequest, availableAgents: string[]): Promise<TaskPlan>;
  validatePlan(plan: TaskPlan): Promise<string[]>;
  getExecutionOrder(plan: TaskPlan): string[][];
  estimateComplexity(subtasks: SubTask[]): 'simple' | 'medium' | 'complex';
}
