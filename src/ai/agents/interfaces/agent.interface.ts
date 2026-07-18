import { ExecutionContext } from '../../execution/execution-context';
import { ProviderPreference } from '../../interfaces/runtime.interface';

export interface AgentCapability {
  name: string;
  description: string;
  confidence: number;
}

export interface AgentMetadata {
  name: string;
  description: string;
  version: string;
  capabilities: AgentCapability[];
  requiredTools: string[];
  supportedProviders: string[];
  priority: number;
  promptName: string;
  promptVersion?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentExecutionStep {
  stepId: string;
  toolName: string;
  input: unknown;
  description: string;
  dependsOn: string[];
  timeout?: number;
}

export interface AgentExecutionPlan {
  planId: string;
  agentName: string;
  requestDescription: string;
  steps: AgentExecutionStep[];
  providerPreference?: ProviderPreference;
  estimatedComplexity: 'simple' | 'medium' | 'complex';
  metadata?: Record<string, unknown>;
}

export interface AgentRequest {
  text: string;
  context: ExecutionContext;
  providerPreference?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentStepResult {
  stepId: string;
  toolName: string;
  success: boolean;
  data: unknown;
  error?: string;
  duration: number;
}

export interface AgentResponse {
  success: boolean;
  agentName: string;
  planId: string;
  results: AgentStepResult[];
  summary: string;
  duration: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface IAgent {
  readonly metadata: AgentMetadata;

  canHandle(request: AgentRequest): Promise<AgentCapability | null>;
  plan(request: AgentRequest): Promise<AgentExecutionPlan>;
  validate(request: AgentRequest): Promise<string[]>;
  execute(request: AgentRequest): Promise<AgentResponse>;
}
