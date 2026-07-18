export type CollaborationStatus = 'forming' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface AgentCollaborationState {
  agentName: string;
  status: 'idle' | 'working' | 'completed' | 'error';
  currentTask?: string;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

export interface CollaborationSession {
  sessionId: string;
  organizationId: string;
  requestId: string;
  agents: string[];
  status: CollaborationStatus;
  state: Map<string, AgentCollaborationState>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}
