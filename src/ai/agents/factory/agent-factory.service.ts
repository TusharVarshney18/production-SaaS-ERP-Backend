import { Injectable, Logger } from '@nestjs/common';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { IAgent, AgentRequest } from '../interfaces/agent.interface';

@Injectable()
export class AgentFactoryService {
  private readonly logger = new Logger(AgentFactoryService.name);

  constructor(private readonly agentRegistry: AgentRegistryService) {}

  getAgent(name: string): IAgent | undefined {
    return this.agentRegistry.get(name);
  }

  async resolveAgent(request: AgentRequest): Promise<IAgent | null> {
    if (request.metadata?.agentName) {
      const named = this.agentRegistry.get(request.metadata.agentName as string);
      if (named) return named;
    }

    return this.agentRegistry.findBestMatch(request);
  }

  getAllAgents(): IAgent[] {
    return this.agentRegistry.getAll();
  }

  getAgentNames(): string[] {
    return this.agentRegistry.getAgentNames();
  }

  hasAgent(name: string): boolean {
    return this.agentRegistry.has(name);
  }
}
