export interface MCPPromptDefinition {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  serverName?: string;
}

export interface MCPPromptGetRequest {
  name: string;
  arguments?: Record<string, string>;
}

export interface MCPPromptGetResponse {
  description?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
}

export interface MCPPromptListResult {
  prompts: MCPPromptDefinition[];
}
