import { Injectable, Logger } from '@nestjs/common';
import { AgentFactoryService } from '../factory/agent-factory.service';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { CapabilityRegistryService } from '../../registry/capability-registry.service';
import {
  IAgent,
  AgentRequest,
  AgentExecutionPlan,
  AgentCapability,
} from '../interfaces/agent.interface';

export interface RouterResult {
  agent: IAgent;
  capability: AgentCapability;
  plan: AgentExecutionPlan;
}

@Injectable()
export class AgentRouterService {
  private readonly logger = new Logger(AgentRouterService.name);

  constructor(
    private readonly agentFactory: AgentFactoryService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly capabilityRegistry: CapabilityRegistryService,
  ) {}

  async route(request: AgentRequest): Promise<RouterResult> {
    const agent = await this.agentFactory.resolveAgent(request);
    if (!agent) {
      throw new Error(
        `No agent found to handle request. Available agents: ${this.agentRegistry.getAgentNames().join(', ')}`,
      );
    }

    const capability = await agent.canHandle(request);
    if (!capability) {
      throw new Error(`Agent "${agent.metadata.name}" cannot handle the request`);
    }

    const plan = await agent.plan(request);

    const capDef = this.capabilityRegistry.get(capability.name);
    if (capDef && request.context.metadata) {
      request.context.metadata.providerPreferences = capDef.providerPreferences;
      request.context.metadata.defaultTemperature = capDef.defaultTemperature;
      request.context.metadata.contextLimit = capDef.contextLimit;
    }

    this.logger.log(
      `Routed request to agent "${agent.metadata.name}" (capability: ${capability.name}, confidence: ${capability.confidence}, steps: ${plan.steps.length})`,
    );

    return { agent, capability, plan };
  }

  async getAgentForRequest(request: AgentRequest): Promise<IAgent | null> {
    return this.agentFactory.resolveAgent(request);
  }

  async getCapabilityForRequest(request: AgentRequest): Promise<AgentCapability | null> {
    const agent = await this.agentFactory.resolveAgent(request);
    if (!agent) return null;
    return agent.canHandle(request);
  }
}
