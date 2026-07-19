import { Injectable, Logger } from '@nestjs/common';
import {
  ITaskDelegationService,
  DelegationRequest,
  DelegationResult,
  AgentWorkload,
} from '../interfaces/delegation.interface';
import { AgentRegistryService } from '../../agents/registry/agent-registry.service';
import { AgentExecutorService } from '../../agents/executor/agent-executor.service';
import { AgentRequest } from '../../agents/interfaces/agent.interface';

@Injectable()
export class TaskDelegationService implements ITaskDelegationService {
  private readonly logger = new Logger(TaskDelegationService.name);
  private readonly workloads = new Map<string, AgentWorkload>();

  constructor(
    private readonly agentRegistry: AgentRegistryService,
    private readonly agentExecutor: AgentExecutorService,
  ) {}

  async delegate(request: DelegationRequest): Promise<DelegationResult> {
    const startTime = Date.now();
    const agentName =
      request.preferredAgent ||
      (await this.findBestAgent(request.requiredCapability || '', request.context));

    if (!agentName) {
      return {
        success: false,
        selectedAgent: '',
        error: 'No suitable agent found for task delegation',
        duration: Date.now() - startTime,
        fallbackAttempted: false,
      };
    }

    const agentRequest: AgentRequest = {
      text: request.taskDescription,
      context: request.context,
      metadata: { ...request.input, agentName },
    };

    try {
      this.trackWorkload(agentName, 'add');
      const response = await this.agentExecutor.execute(agentRequest);
      this.trackWorkload(agentName, 'remove');

      return {
        success: response.success,
        selectedAgent: agentName,
        agentResponse: response,
        duration: Date.now() - startTime,
        fallbackAttempted: false,
      };
    } catch (error) {
      this.trackWorkload(agentName, 'remove');

      if (request.retryCount && request.retryCount > 0) {
        const fallbackAgent = await this.findFallbackAgent(agentName, request.context);
        if (fallbackAgent) {
          this.logger.warn(`Failing over from ${agentName} to ${fallbackAgent}`);
          const fallbackRequest: AgentRequest = {
            text: request.taskDescription,
            context: request.context,
            metadata: { ...request.input, agentName: fallbackAgent },
          };
          try {
            const response = await this.agentExecutor.execute(fallbackRequest);
            return {
              success: response.success,
              selectedAgent: fallbackAgent,
              agentResponse: response,
              duration: Date.now() - startTime,
              fallbackAttempted: true,
            };
          } catch (fallbackError) {
            return {
              success: false,
              selectedAgent: fallbackAgent,
              error: (fallbackError as Error).message,
              duration: Date.now() - startTime,
              fallbackAttempted: true,
            };
          }
        }
      }

      return {
        success: false,
        selectedAgent: agentName,
        error: (error as Error).message,
        duration: Date.now() - startTime,
        fallbackAttempted: false,
      };
    }
  }

  async findBestAgent(
    requiredCapability: string,
    _context: import('../../execution/execution-context').ExecutionContext,
  ): Promise<string | null> {
    const agents = this.agentRegistry.getAll();

    if (requiredCapability) {
      const matching = agents.filter((a) =>
        a.metadata.capabilities.some((c) => c.name === requiredCapability),
      );
      if (matching.length > 0) {
        const sorted = this.sortByWorkload(matching.map((a) => a.metadata.name));
        return sorted[0] || null;
      }
    }

    if (agents.length === 0) return null;
    return this.sortByWorkload(agents.map((a) => a.metadata.name))[0] || null;
  }

  getWorkload(agentName: string): AgentWorkload | undefined {
    return this.workloads.get(agentName);
  }

  getAllWorkloads(): AgentWorkload[] {
    return [...this.workloads.values()];
  }

  resetWorkload(agentName: string): void {
    this.workloads.delete(agentName);
  }

  private async findFallbackAgent(
    excludeAgent: string,
    _context: import('../../execution/execution-context').ExecutionContext,
  ): Promise<string | null> {
    const agents = this.agentRegistry.getAll().filter((a) => a.metadata.name !== excludeAgent);

    if (agents.length === 0) return null;
    return this.sortByWorkload(agents.map((a) => a.metadata.name))[0] || null;
  }

  private sortByWorkload(agentNames: string[]): string[] {
    return agentNames.sort((a, b) => {
      const wA = this.workloads.get(a);
      const wB = this.workloads.get(b);
      const loadA = wA ? wA.activeTasks + wA.queuedTasks : 0;
      const loadB = wB ? wB.activeTasks + wB.queuedTasks : 0;
      return loadA - loadB;
    });
  }

  private trackWorkload(agentName: string, action: 'add' | 'remove'): void {
    if (!this.workloads.has(agentName)) {
      this.workloads.set(agentName, {
        agentName,
        activeTasks: 0,
        queuedTasks: 0,
        averageDuration: 0,
        lastActiveAt: new Date().toISOString(),
      });
    }

    const workload = this.workloads.get(agentName)!;
    if (action === 'add') {
      workload.activeTasks++;
    } else {
      workload.activeTasks = Math.max(0, workload.activeTasks - 1);
    }
    workload.lastActiveAt = new Date().toISOString();
  }
}
