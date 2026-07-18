export interface DiscoveryResult {
  serverId: string;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
  capabilities: string[];
  version: string;
  discoveredAt: string;
  errors?: string[];
}

export interface IMCPDiscoveryService {
  discoverServer(serverId: string, organizationId: string): Promise<DiscoveryResult>;
  discoverAll(organizationId: string): Promise<DiscoveryResult[]>;
  refresh(serverId: string, organizationId: string): Promise<DiscoveryResult>;
  getCacheStats(organizationId: string): { cached: number; expired: number };
}
