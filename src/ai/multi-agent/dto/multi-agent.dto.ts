export interface AgentTaskAssignment {
  agentName: string;
  taskDescription: string;
  input: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  dependsOn: string[];
  timeout?: number;
}

export interface MultiAgentRequest {
  text: string;
  organizationId: string;
  userId: string;
  requestId?: string;
  agents?: string[];
  workflowType?: 'pipeline' | 'tree' | 'dag';
  requireConsensus?: boolean;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface MultiAgentResult {
  agentName: string;
  success: boolean;
  summary: string;
  duration: number;
  data?: unknown;
  error?: string;
}

export interface MultiAgentResponse {
  success: boolean;
  summary: string;
  duration: number;
  results: MultiAgentResult[];
  consensusResult?: {
    reached: boolean;
    confidence: number;
    votes: Array<{ agentName: string; choice: string; confidence: number }>;
  };
  error?: string;
  requestId: string;
}
