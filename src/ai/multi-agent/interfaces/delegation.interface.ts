import { AgentRequest, AgentResponse, AgentCapability } from '../../agents/interfaces/agent.interface';

export interface AgentWorkload {
  agentName: string;
  activeTasks: number;
  queuedTasks: number;
  averageDuration: number;
  lastActiveAt: string;
}

export interface DelegationRequest {
  taskDescription: string;
  requiredCapability?: string;
  preferredAgent?: string;
  excludedAgents?: string[];
  input: Record<string, unknown>;
  context: import('../../execution/execution-context').ExecutionContext;
  timeout?: number;
  retryCount?: number;
}

export interface DelegationResult {
  success: boolean;
  selectedAgent: string;
  agentResponse?: AgentResponse;
  error?: string;
  duration: number;
  fallbackAttempted: boolean;
}

export interface ITaskDelegationService {
  delegate(request: DelegationRequest): Promise<DelegationResult>;
  findBestAgent(requiredCapability: string, context: import('../../execution/execution-context').ExecutionContext): Promise<string | null>;
  getWorkload(agentName: string): AgentWorkload | undefined;
  getAllWorkloads(): AgentWorkload[];
  resetWorkload(agentName: string): void;
}
