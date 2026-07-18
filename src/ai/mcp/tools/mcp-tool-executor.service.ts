import { Injectable, Logger } from '@nestjs/common';
import { IMCPToolExecutor, MCPToolResult, mcpToolToAIToolParams } from '../interfaces/tool-executor.interface';
import { MCPServerRegistry } from '../registry/mcp-server.registry';
import { MCPAuthorizationService } from '../authorization/mcp-authorization.service';
import { ExecutionContext } from '../../execution/execution-context';
import { AITool } from '../../tools/interfaces/ai-tool.interface';
import { AIToolResult } from '../../interfaces/runtime.interface';
import { MCPError, MCPErrorCode } from '../interfaces/mcp-error.interface';

@Injectable()
export class MCPToolExecutorService implements IMCPToolExecutor {
  private readonly logger = new Logger(MCPToolExecutorService.name);

  constructor(
    private readonly registry: MCPServerRegistry,
    private readonly auth: MCPAuthorizationService,
  ) {}

  async execute(serverName: string, toolName: string, args: unknown): Promise<MCPToolResult> {
    const server = this.registry.getServer(serverName, '');
    if (!server) {
      return {
        success: false,
        content: [{ type: 'text', text: `MCP server "${serverName}" not found` }],
        isError: true,
      };
    }

    try {
      const result = await server.server.executeTool(toolName, args);
      return {
        success: true,
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    } catch (error) {
      return {
        success: false,
        content: [{ type: 'text', text: (error as Error).message }],
        isError: true,
      };
    }
  }

  async *executeWithStream(
    serverName: string,
    toolName: string,
    args: unknown,
  ): AsyncIterable<MCPToolResult> {
    yield await this.execute(serverName, toolName, args);
  }

  createAIToolAdapter(serverId: string, toolDef: import('../interfaces/tool-executor.interface').MCPToolDefinition): AITool {
    return {
      name: `mcp:${serverId}:${toolDef.name}`,
      description: toolDef.description || `MCP tool: ${toolDef.name} on ${serverId}`,
      version: '1.0.0',
      category: 'mcp',
      parameters: mcpToolToAIToolParams(toolDef),
      permissions: ['mcp:tool:execute'],
      timeout: 30000,
      requiresConfirmation: false,
      providerSupport: [],
      metadata: {
        serverId,
        mcpToolName: toolDef.name,
        mcpServerName: serverId,
      },
      execute: async (input: unknown, _context: ExecutionContext): Promise<AIToolResult<unknown>> => {
        const startTime = Date.now();
        try {
          const result = await this.execute(serverId, toolDef.name, input);
          return {
            success: result.success,
            data: result.content,
            duration: Date.now() - startTime,
          };
        } catch (error) {
          return {
            success: false,
            data: null,
            error: (error as Error).message,
            duration: Date.now() - startTime,
          };
        }
      },
    };
  }
}
