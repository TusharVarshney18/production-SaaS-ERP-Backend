import { AgentRequest } from '../../agents/interfaces/agent.interface';
import { ExecutionContext } from '../../execution/execution-context';

export interface OrchestrationRequest {
  text: string;
  context: ExecutionContext;
  workflowType?: 'pipeline' | 'tree' | 'dag';
  requireConsensus?: boolean;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface OrchestrationResult {
  success: boolean;
  summary: string;
  duration: number;
  agentResults: Array<{
    agentName: string;
    success: boolean;
    summary: string;
    duration: number;
  }>;
  consensusResult?: {
    reached: boolean;
    confidence: number;
    votes: Array<{ agentName: string; choice: string; confidence: number }>;
  };
  error?: string;
  requestId: string;
}

export interface IAgentOrchestrator {
  orchestrate(request: OrchestrationRequest): Promise<OrchestrationResult>;
  orchestrateWithAgents(request: OrchestrationRequest, agentNames: string[]): Promise<OrchestrationResult>;
  cancel(organizationId: string, requestId: string): Promise<boolean>;
  getActiveOrchestrations(organizationId: string): string[];
}
