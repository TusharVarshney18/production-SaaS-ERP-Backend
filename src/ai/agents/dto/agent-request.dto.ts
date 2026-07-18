import { ExecutionContext } from '../../execution/execution-context';

export class AgentRequestDto {
  text: string;
  providerPreference?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRequestWithContext {
  text: string;
  context: ExecutionContext;
  providerPreference?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}
