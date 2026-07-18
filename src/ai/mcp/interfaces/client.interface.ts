export interface ClientInfo {
  name: string;
  version: string;
}

export interface ClientCapabilities {
  streaming: boolean;
}

export interface IMCPClient {
  readonly connected: boolean;
  connect(serverId: string): Promise<void>;
  disconnect(serverId?: string): Promise<void>;
  listTools(serverId: string): Promise<unknown>;
  listResources(serverId: string): Promise<unknown>;
  listPrompts(serverId: string): Promise<unknown>;
  executeTool(serverId: string, toolName: string, args: unknown): Promise<unknown>;
  readResource(serverId: string, uri: string): Promise<unknown>;
  getPrompt(serverId: string, name: string, args?: Record<string, string>): Promise<unknown>;
  health(serverId: string): Promise<boolean>;
  getConnectedServers(): string[];
}
