export type MCPRole = 'user' | 'assistant';
export type MCPContentType = 'text' | 'image' | 'resource' | 'tool_result';

export interface MCPContent {
  type: MCPContentType;
  text?: string;
  mimeType?: string;
  uri?: string;
  data?: string;
}

export interface MCPMessage {
  role: MCPRole;
  content: MCPContent | MCPContent[];
}

export interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
  id?: string;
}

export interface MCPResponse {
  id: string;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    data?: unknown;
  };
}

export interface MCPNotification {
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPBatchRequest {
  requests: MCPRequest[];
  parallel?: boolean;
}
