export class AgentStepResultDto {
  stepId: string;
  toolName: string;
  success: boolean;
  data: unknown;
  error?: string;
  duration: number;
}

export class AgentResponseDto {
  success: boolean;
  agentName: string;
  planId: string;
  results: AgentStepResultDto[];
  summary: string;
  duration: number;
  error?: string;
  metadata?: Record<string, unknown>;
}
