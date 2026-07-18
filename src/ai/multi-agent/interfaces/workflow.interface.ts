import { AgentRequest, AgentResponse } from '../../agents/interfaces/agent.interface';
import { ExecutionContext } from '../../execution/execution-context';
import { SubTask, TaskPriority } from './planner.interface';

export type WorkflowType = 'pipeline' | 'tree' | 'dag';

export interface WorkflowStep {
  id: string;
  name: string;
  agentName?: string;
  capability?: string;
  input: Record<string, unknown>;
  dependsOn: string[];
  priority: TaskPriority;
  timeout?: number;
  retryCount?: number;
  condition?: string;
  onSuccess?: string[];
  onFailure?: string[];
  metadata?: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  type: WorkflowType;
  steps: WorkflowStep[];
  timeout?: number;
  maxConcurrency?: number;
  metadata?: Record<string, unknown>;
}

export interface WorkflowExecutionContext {
  workflowId: string;
  organizationId: string;
  userId: string;
  requestId: string;
  startedAt: string;
  stepResults: Map<string, unknown>;
  variables: Map<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface IWorkflowManager {
  createWorkflow(definition: WorkflowDefinition): Promise<string>;
  executeWorkflow(workflowId: string, context: ExecutionContext): Promise<boolean>;
  getWorkflowStatus(workflowId: string): WorkflowExecutionContext | undefined;
  cancelWorkflow(workflowId: string, organizationId: string): Promise<boolean>;
  listWorkflows(organizationId: string): WorkflowExecutionContext[];
  getExecutionOrder(definition: WorkflowDefinition): string[][];
}
