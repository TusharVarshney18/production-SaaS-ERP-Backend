import { ToolParameter } from '../../interfaces/runtime.interface';

export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  serverName?: string;
}

export interface MCPToolResult {
  success: boolean;
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

export function mcpToolToAIToolParams(tool: MCPToolDefinition): ToolParameter[] {
  if (!tool.inputSchema?.properties) return [];
  return Object.entries(tool.inputSchema.properties).map(([name, schema]: [string, any]) => ({
    name,
    type: schema.type === 'integer' ? 'number' : (schema.type || 'string'),
    required: (tool.inputSchema.required || []).includes(name),
    description: schema.description || '',
  }));
}

export interface IMCPToolExecutor {
  execute(serverName: string, toolName: string, args: unknown): Promise<MCPToolResult>;
  executeWithStream(
    serverName: string,
    toolName: string,
    args: unknown,
  ): AsyncIterable<MCPToolResult>;
}
