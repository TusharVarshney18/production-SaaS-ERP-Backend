export interface MCPResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverName?: string;
}

export interface MCPResourceReadRequest {
  uri: string;
}

export interface MCPResourceReadResponse {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

export interface MCPResourceListResult {
  resources: MCPResourceDefinition[];
}
