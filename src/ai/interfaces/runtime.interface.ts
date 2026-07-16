export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  defaultValue?: unknown;
  enum?: string[];
}

export interface ToolMetadata {
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  parameters: ToolParameter[];
  permissions: string[];
  timeout: number;
  requiresConfirmation: boolean;
  providerSupport: string[];
  metadata: Record<string, unknown>;
}

export interface AIToolResult<TOutput = unknown> {
  success: boolean;
  data: TOutput;
  error?: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface PromptVariable {
  name: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface PromptDefinition {
  name: string;
  version: string;
  template: string;
  variables: PromptVariable[];
  category?: string;
  description?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface CapabilityDefinition {
  name: string;
  description: string;
  supportedTools: string[];
  providerPreferences: ProviderPreference[];
  models: string[];
  defaultTemperature: number;
  contextLimit: number;
  streamingSupported: boolean;
  metadata?: Record<string, unknown>;
}

export interface ProviderPreference {
  provider: string;
  priority: number;
  model?: string;
}

export interface SandboxOptions {
  executionTimeout: number;
  maxInputSize: number;
  enableAudit: boolean;
  enableRateLimiting: boolean;
  sensitiveFields: string[];
}

export interface ExecutionPipelineResult {
  success: boolean;
  result: unknown;
  duration: number;
  toolName: string;
  requestId: string;
  error?: string;
  auditLogged: boolean;
}
