export class AgentExecutionPlanDto {
  planId: string;
  agentName: string;
  requestDescription: string;
  steps: AgentExecutionStepDto[];
  estimatedComplexity: 'simple' | 'medium' | 'complex';
}

export class AgentExecutionStepDto {
  stepId: string;
  toolName: string;
  description: string;
  dependsOn: string[];
}
