import { Injectable, Logger } from '@nestjs/common';
import {
  IAgent,
  AgentCapability,
  AgentMetadata,
  AgentRequest,
} from '../interfaces/agent.interface';

@Injectable()
export class AgentRegistryService {
  private readonly logger = new Logger(AgentRegistryService.name);
  private readonly agents = new Map<string, IAgent>();

  register(agent: IAgent): void {
    const name = agent.metadata.name;
    if (this.agents.has(name)) {
      this.logger.warn(`Agent "${name}" is already registered. Overwriting.`);
    }
    this.agents.set(name, agent);
    this.logger.log(
      `Agent registered: ${name} (v${agent.metadata.version}, ${agent.metadata.capabilities.length} capabilities, ${agent.metadata.requiredTools.length} tools)`,
    );
  }

  get(name: string): IAgent | undefined {
    return this.agents.get(name);
  }

  getAll(): IAgent[] {
    return [...this.agents.values()];
  }

  has(name: string): boolean {
    return this.agents.has(name);
  }

  getCount(): number {
    return this.agents.size;
  }

  findByCapability(capabilityName: string): IAgent[] {
    return this.getAll().filter((agent) =>
      agent.metadata.capabilities.some((c) => c.name === capabilityName),
    );
  }

  findByTool(toolName: string): IAgent[] {
    return this.getAll().filter((agent) => agent.metadata.requiredTools.includes(toolName));
  }

  findByProvider(providerName: string): IAgent[] {
    return this.getAll().filter((agent) =>
      agent.metadata.supportedProviders.includes(providerName),
    );
  }

  async findBestMatch(request: AgentRequest): Promise<IAgent | null> {
    const candidates: Array<{ agent: IAgent; score: number }> = [];

    for (const agent of this.getAll()) {
      const capability = await agent.canHandle(request);
      if (capability) {
        candidates.push({ agent, score: capability.confidence * agent.metadata.priority });
      }
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].agent;
  }

  search(query: string): AgentMetadata[] {
    const lower = query.toLowerCase();
    return this.getAll()
      .filter(
        (agent) =>
          agent.metadata.name.toLowerCase().includes(lower) ||
          agent.metadata.description.toLowerCase().includes(lower) ||
          agent.metadata.capabilities.some(
            (c) =>
              c.name.toLowerCase().includes(lower) || c.description.toLowerCase().includes(lower),
          ),
      )
      .map((agent) => agent.metadata);
  }

  remove(name: string): boolean {
    return this.agents.delete(name);
  }

  getAgentNames(): string[] {
    return [...this.agents.keys()];
  }

  getCapabilities(): AgentCapability[] {
    const all: AgentCapability[] = [];
    const seen = new Set<string>();
    for (const agent of this.getAll()) {
      for (const cap of agent.metadata.capabilities) {
        if (!seen.has(cap.name)) {
          seen.add(cap.name);
          all.push(cap);
        }
      }
    }
    return all;
  }
}
