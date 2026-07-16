export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  model?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  latency: number;
  finishReason: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  usage: { promptTokens: number; totalTokens: number };
}

export interface ProviderHealth {
  provider: string;
  available: boolean;
  latency: number;
  configured: boolean;
  model: string;
}

export interface ProviderConfig {
  name: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
  models: Record<string, ModelConfig>;
  options?: Record<string, unknown>;
}

export interface ModelConfig {
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
}

export interface AiConfig {
  defaultProvider: string;
  temperature: number;
  timeout: number;
  retries: number;
  streaming: boolean;
  providers: Record<string, ProviderConfig>;
}

export interface HealthCheckResult {
  status: string;
  timestamp: string;
  providers: ProviderHealth[];
}
