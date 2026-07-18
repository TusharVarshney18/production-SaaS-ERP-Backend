import { Injectable, Logger } from '@nestjs/common';
import { IMCPDiscoveryService, DiscoveryResult } from '../interfaces/discovery.interface';
import { MCPServerRegistry } from '../registry/mcp-server.registry';
import { MCPError, MCPErrorCode } from '../interfaces/mcp-error.interface';

@Injectable()
export class MCPDiscoveryService implements IMCPDiscoveryService {
  private readonly logger = new Logger(MCPDiscoveryService.name);

  constructor(private readonly registry: MCPServerRegistry) {}

  async discoverServer(serverId: string, organizationId: string): Promise<DiscoveryResult> {
    const registered = this.registry.getServer(serverId, organizationId);
    if (!registered) {
      throw new MCPError(
        `MCP server "${serverId}" not registered for org ${organizationId}`,
        MCPErrorCode.NOT_FOUND,
      );
    }

    const errors: string[] = [];
    let toolCount = 0;
    let resourceCount = 0;
    let promptCount = 0;

    try {
      const tools = await registered.server.listTools();
      toolCount = tools.length;
    } catch (error) {
      errors.push(`Tool discovery failed: ${(error as Error).message}`);
    }

    try {
      const resources = await registered.server.listResources();
      resourceCount = resources.length;
    } catch {
      resourceCount = 0;
    }

    try {
      const prompts = await registered.server.listPrompts();
      promptCount = prompts.length;
    } catch {
      promptCount = 0;
    }

    const capabilities = Object.entries(registered.server.info.capabilities)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const result: DiscoveryResult = {
      serverId,
      toolCount,
      resourceCount,
      promptCount,
      capabilities,
      version: registered.server.info.version,
      discoveredAt: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    };

    this.logger.log(
      `MCP discovery for "${serverId}" (org ${organizationId}): ${toolCount} tools, ${resourceCount} resources, ${promptCount} prompts`,
    );

    return result;
  }

  async discoverAll(organizationId: string): Promise<DiscoveryResult[]> {
    const servers = this.registry.listServers(organizationId);
    const results = await Promise.allSettled(
      servers.map((s) => this.discoverServer(s.id, organizationId)),
    );
    return results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<DiscoveryResult>).value);
  }

  async refresh(serverId: string, organizationId: string): Promise<DiscoveryResult> {
    await this.registry.refreshServer(serverId, organizationId);
    return this.discoverServer(serverId, organizationId);
  }

  getCacheStats(organizationId: string): { cached: number; expired: number } {
    const servers = this.registry.listServers(organizationId);
    return { cached: servers.length, expired: 0 };
  }
}
