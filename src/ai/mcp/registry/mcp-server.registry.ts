import { Injectable, Logger } from '@nestjs/common';
import { IMCPRegistry, RegisteredServer } from '../interfaces/registry.interface';
import { IMCPServer } from '../interfaces/server.interface';
import { MCPToolDefinition } from '../dto/tool.dto';
import { MCPResourceDefinition } from '../dto/resource.dto';
import { MCPPromptDefinition } from '../dto/prompt.dto';
import { CACHE_TTL_MS } from '../../constants';

interface CachedToolList {
  tools: MCPToolDefinition[];
  cachedAt: number;
}

interface CachedResourceList {
  resources: MCPResourceDefinition[];
  cachedAt: number;
}

interface CachedPromptList {
  prompts: MCPPromptDefinition[];
  cachedAt: number;
}

@Injectable()
export class MCPServerRegistry implements IMCPRegistry {
  private readonly logger = new Logger(MCPServerRegistry.name);
  private readonly servers = new Map<string, RegisteredServer>();
  private readonly toolCache = new Map<string, CachedToolList>();
  private readonly resourceCache = new Map<string, CachedResourceList>();
  private readonly promptCache = new Map<string, CachedPromptList>();
  private readonly cacheTtl = CACHE_TTL_MS;

  async register(
    serverId: string,
    server: IMCPServer,
    organizationId: string,
    config: Record<string, unknown> = {},
  ): Promise<void> {
    const key = this.key(serverId, organizationId);
    const now = new Date().toISOString();
    this.servers.set(key, {
      id: serverId,
      server,
      organizationId,
      config,
      registeredAt: now,
      lastSeenAt: now,
      enabled: true,
    });
    this.logger.log(`MCP server registered: ${serverId} for org ${organizationId}`);
  }

  async unregister(serverId: string, organizationId: string): Promise<boolean> {
    const key = this.key(serverId, organizationId);
    this.clearCache(serverId, organizationId);
    const deleted = this.servers.delete(key);
    if (deleted) {
      this.logger.log(`MCP server unregistered: ${serverId} for org ${organizationId}`);
    }
    return deleted;
  }

  getServer(serverId: string, organizationId: string): RegisteredServer | undefined {
    return this.servers.get(this.key(serverId, organizationId));
  }

  listServers(organizationId: string): RegisteredServer[] {
    return [...this.servers.values()].filter((s) => s.organizationId === organizationId);
  }

  async getTool(
    serverId: string,
    toolName: string,
    organizationId: string,
  ): Promise<MCPToolDefinition | undefined> {
    const tools = await this.getOrFetchTools(serverId, organizationId);
    return tools.find((t) => t.name === toolName);
  }

  async getResource(
    serverId: string,
    uri: string,
    organizationId: string,
  ): Promise<MCPResourceDefinition | undefined> {
    const resources = await this.getOrFetchResources(serverId, organizationId);
    return resources.find((r) => r.uri === uri);
  }

  async getPrompt(
    serverId: string,
    name: string,
    organizationId: string,
  ): Promise<MCPPromptDefinition | undefined> {
    const prompts = await this.getOrFetchPrompts(serverId, organizationId);
    return prompts.find((p) => p.name === name);
  }

  async searchTools(
    query: string,
    organizationId: string,
  ): Promise<Array<{ serverId: string; tool: MCPToolDefinition }>> {
    const results: Array<{ serverId: string; tool: MCPToolDefinition }> = [];
    const lower = query.toLowerCase();
    for (const [key, registered] of this.servers.entries()) {
      if (!key.endsWith(`:${organizationId}`) || !registered.enabled) continue;
      const tools = await this.getOrFetchTools(registered.id, organizationId);
      for (const tool of tools) {
        if (
          tool.name.toLowerCase().includes(lower) ||
          (tool.description && tool.description.toLowerCase().includes(lower))
        ) {
          results.push({ serverId: registered.id, tool });
        }
      }
    }
    return results;
  }

  async getAllTools(
    organizationId: string,
  ): Promise<Array<{ serverId: string; tool: MCPToolDefinition }>> {
    const results: Array<{ serverId: string; tool: MCPToolDefinition }> = [];
    for (const registered of this.listServers(organizationId)) {
      if (!registered.enabled) continue;
      const tools = await this.getOrFetchTools(registered.id, organizationId);
      for (const tool of tools) {
        results.push({ serverId: registered.id, tool });
      }
    }
    return results;
  }

  async refreshServer(serverId: string, organizationId: string): Promise<boolean> {
    const registered = this.getServer(serverId, organizationId);
    if (!registered) return false;
    this.clearCache(serverId, organizationId);
    try {
      await registered.server.listTools();
      registered.lastSeenAt = new Date().toISOString();
      return true;
    } catch {
      return false;
    }
  }

  getServerCount(organizationId: string): number {
    return this.listServers(organizationId).length;
  }

  private async getOrFetchTools(
    serverId: string,
    organizationId: string,
  ): Promise<MCPToolDefinition[]> {
    const cacheKey = `tools:${this.key(serverId, organizationId)}`;
    const cached = this.toolCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.cacheTtl) {
      return cached.tools;
    }
    const registered = this.getServer(serverId, organizationId);
    if (!registered) return [];
    try {
      const tools = await registered.server.listTools();
      this.toolCache.set(cacheKey, { tools, cachedAt: Date.now() });
      return tools;
    } catch {
      return cached?.tools || [];
    }
  }

  private async getOrFetchResources(
    serverId: string,
    organizationId: string,
  ): Promise<MCPResourceDefinition[]> {
    const cacheKey = `resources:${this.key(serverId, organizationId)}`;
    const cached = this.resourceCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.cacheTtl) {
      return cached.resources;
    }
    const registered = this.getServer(serverId, organizationId);
    if (!registered) return [];
    try {
      const resources = await registered.server.listResources();
      this.resourceCache.set(cacheKey, { resources, cachedAt: Date.now() });
      return resources;
    } catch {
      return cached?.resources || [];
    }
  }

  private async getOrFetchPrompts(
    serverId: string,
    organizationId: string,
  ): Promise<MCPPromptDefinition[]> {
    const cacheKey = `prompts:${this.key(serverId, organizationId)}`;
    const cached = this.promptCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.cacheTtl) {
      return cached.prompts;
    }
    const registered = this.getServer(serverId, organizationId);
    if (!registered) return [];
    try {
      const prompts = await registered.server.listPrompts();
      this.promptCache.set(cacheKey, { prompts, cachedAt: Date.now() });
      return prompts;
    } catch {
      return cached?.prompts || [];
    }
  }

  private clearCache(serverId: string, organizationId: string): void {
    const base = this.key(serverId, organizationId);
    this.toolCache.delete(`tools:${base}`);
    this.resourceCache.delete(`resources:${base}`);
    this.promptCache.delete(`prompts:${base}`);
  }

  private key(serverId: string, organizationId: string): string {
    return `${serverId}:${organizationId}`;
  }

  clearAllCaches(): void {
    this.toolCache.clear();
    this.resourceCache.clear();
    this.promptCache.clear();
    this.logger.log('MCP registry caches cleared');
  }
}
