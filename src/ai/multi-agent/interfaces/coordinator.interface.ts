import { AgentResponse } from '../../agents/interfaces/agent.interface';
import { TaskPlan, SubTask } from './planner.interface';
import { ExecutionContext } from '../../execution/execution-context';

export interface CoordinationRequest {
  plan: TaskPlan;
  context: ExecutionContext;
  requireConsensus?: boolean;
  timeout?: number;
}

export interface SubTaskResult {
  subtaskId: string;
  agentName: string;
  success: boolean;
  data: unknown;
  error?: string;
  duration: number;
  agentResponse?: AgentResponse;
}

export interface CoordinationResult {
  success: boolean;
  planId: string;
  subtaskResults: SubTaskResult[];
  duration: number;
  error?: string;
}

export interface ITaskCoordinator {
  coordinate(request: CoordinationRequest): Promise<CoordinationResult>;
  executeSubtask(subtask: SubTask, context: ExecutionContext): Promise<SubTaskResult>;
  cancelCoordination(planId: string, organizationId: string): Promise<boolean>;
}
