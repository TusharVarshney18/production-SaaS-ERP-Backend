import { IMCPServer } from './server.interface';
import { MCPToolDefinition } from './tool-executor.interface';
import { MCPResourceDefinition } from '../dto/resource.dto';
import { MCPPromptDefinition } from '../dto/prompt.dto';

export interface RegisteredServer {
  id: string;
  server: IMCPServer;
  organizationId: string;
  config: Record<string, unknown>;
  registeredAt: string;
  lastSeenAt: string;
  enabled: boolean;
  tags?: string[];
}

export interface IMCPRegistry {
  register(serverId: string, server: IMCPServer, organizationId: string, config?: Record<string, unknown>): Promise<void>;
  unregister(serverId: string, organizationId: string): Promise<boolean>;
  getServer(serverId: string, organizationId: string): RegisteredServer | undefined;
  listServers(organizationId: string): RegisteredServer[];
  getTool(serverId: string, toolName: string, organizationId: string): Promise<MCPToolDefinition | undefined>;
  getResource(serverId: string, uri: string, organizationId: string): Promise<MCPResourceDefinition | undefined>;
  getPrompt(serverId: string, name: string, organizationId: string): Promise<MCPPromptDefinition | undefined>;
  searchTools(query: string, organizationId: string): Promise<Array<{ serverId: string; tool: MCPToolDefinition }>>;
  getAllTools(organizationId: string): Promise<Array<{ serverId: string; tool: MCPToolDefinition }>>;
  refreshServer(serverId: string, organizationId: string): Promise<boolean>;
  getServerCount(organizationId: string): number;
}
