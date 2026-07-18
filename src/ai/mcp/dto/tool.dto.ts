export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  outputSchema?: Record<string, unknown>;
  serverName?: string;
}

export interface MCPToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolCallResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

export interface MCPToolListResult {
  tools: MCPToolDefinition[];
}
