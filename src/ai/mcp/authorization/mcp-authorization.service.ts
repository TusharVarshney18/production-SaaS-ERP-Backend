import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { AIPermissionService } from '../../authorization/ai-permission.service';
import { ExecutionContext } from '../../execution/execution-context';
import { MCPError, MCPErrorCode } from '../interfaces/mcp-error.interface';

export interface ToolAllowListEntry {
  serverId: string;
  toolName: string;
  allowed: boolean;
}

@Injectable()
export class MCPAuthorizationService {
  private readonly logger = new Logger(MCPAuthorizationService.name);
  private readonly allowLists = new Map<string, Map<string, boolean>>();

  setToolAllowList(organizationId: string, tools: ToolAllowListEntry[]): void {
    const orgList = new Map<string, boolean>();
    for (const entry of tools) {
      orgList.set(`${entry.serverId}:${entry.toolName}`, entry.allowed);
    }
    this.allowLists.set(organizationId, orgList);
    this.logger.log(`MCP tool allow-list updated for org ${organizationId}: ${tools.length} entries`);
  }

  isToolAllowed(serverId: string, toolName: string, organizationId: string): boolean {
    const orgList = this.allowLists.get(organizationId);
    if (!orgList) return true;
    const entry = orgList.get(`${serverId}:${toolName}`);
    return entry === undefined || entry;
  }

  async enforceToolAccess(
    serverId: string,
    toolName: string,
    context: ExecutionContext,
  ): Promise<void> {
    if (!this.isToolAllowed(serverId, toolName, context.organizationId)) {
      throw new ForbiddenException(
        `MCP tool "${toolName}" on server "${serverId}" is not allowed for org ${context.organizationId}`,
      );
    }
    this.logger.debug(
      `MCP tool access granted: ${serverId}/${toolName} (org: ${context.organizationId}, user: ${context.userId})`,
    );
  }

  validateInputSize(input: unknown, maxBytes = 1_048_576): void {
    if (input === undefined || input === null) return;
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    const size = Buffer.byteLength(str, 'utf-8');
    if (size > maxBytes) {
      throw new MCPError(
        `Input size ${size} bytes exceeds maximum ${maxBytes} bytes`,
        MCPErrorCode.INVALID_REQUEST,
        400,
      );
    }
  }
}
