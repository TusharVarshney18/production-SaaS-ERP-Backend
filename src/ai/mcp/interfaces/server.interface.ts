import { MCPToolDefinition } from './tool-executor.interface';
import { MCPResourceDefinition } from '../dto/resource.dto';
import { MCPPromptDefinition } from '../dto/prompt.dto';

export interface ServerCapabilities {
  tools: boolean;
  resources: boolean;
  prompts: boolean;
  streaming: boolean;
  logging: boolean;
}

export interface ServerInfo {
  name: string;
  version: string;
  description?: string;
  vendor?: string;
  capabilities: ServerCapabilities;
}

export interface IMCPServer {
  readonly info: ServerInfo;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<MCPToolDefinition[]>;
  listResources(): Promise<MCPResourceDefinition[]>;
  listPrompts(): Promise<MCPPromptDefinition[]>;
  executeTool(name: string, args: unknown): Promise<unknown>;
  readResource(uri: string): Promise<unknown>;
  getPrompt(name: string, args?: Record<string, string>): Promise<unknown>;
  health(): Promise<boolean>;
}
