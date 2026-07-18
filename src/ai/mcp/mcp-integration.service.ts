import { Injectable, Logger } from '@nestjs/common';
import { MCPServerRegistry } from './registry/mcp-server.registry';
import { MCPToolExecutorService } from './tools/mcp-tool-executor.service';
import { MCPClientService } from './client/mcp-client.service';
import { ToolRegistryService } from '../registry/tool-registry.service';
import { MCPDiscoveryService } from './discovery/mcp-discovery.service';
import { AITool } from '../tools/interfaces/ai-tool.interface';

@Injectable()
export class MCPIntegrationService {
  private readonly logger = new Logger(MCPIntegrationService.name);

  constructor(
    private readonly registry: MCPServerRegistry,
    private readonly toolExecutor: MCPToolExecutorService,
    private readonly client: MCPClientService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly discovery: MCPDiscoveryService,
  ) {}

  async syncToolsToRegistry(organizationId: string): Promise<number> {
    const allTools = await this.registry.getAllTools(organizationId);
    let count = 0;

    for (const { serverId, tool } of allTools) {
      const toolName = `mcp:${serverId}:${tool.name}`;
      if (!this.toolRegistry.has(toolName)) {
        const adapter = this.toolExecutor.createAIToolAdapter(serverId, tool);
        this.toolRegistry.register(adapter);
        count++;
      }
    }

    if (count > 0) {
      this.logger.log(`Synced ${count} MCP tools to AI tool registry for org ${organizationId}`);
    }
    return count;
  }

  async syncAllOrganizations(): Promise<number> {
    const serverIds = this.client.getConnectedServers();
    let total = 0;

    for (const serverId of serverIds) {
      const result = await this.discovery.discoverServer(serverId, '');
      if (result.toolCount > 0) {
        const synced = await this.syncToolsToRegistry('');
        total += synced;
      }
    }

    return total;
  }

  async refreshAndSync(organizationId: string): Promise<number> {
    await this.discovery.discoverAll(organizationId);
    return this.syncToolsToRegistry(organizationId);
  }
}
