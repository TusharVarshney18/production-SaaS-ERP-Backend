import { Injectable, Logger } from '@nestjs/common';
import {
  IAgentOrchestrator,
  OrchestrationRequest,
  OrchestrationResult,
} from '../interfaces/orchestrator.interface';
import { TaskPlannerService } from '../planner/task-planner.service';
import { TaskCoordinator } from '../coordinator/task-coordinator.service';
import { TaskDelegationService } from '../delegation/task-delegation.service';
import { WorkflowManager } from '../workflows/workflow.manager';
import { ConsensusEngine } from '../consensus/consensus.engine';
import { SharedMemoryService } from '../shared-memory/shared-memory.service';
import { AgentRegistryService } from '../../agents/registry/agent-registry.service';
import { AgentRequest } from '../../agents/interfaces/agent.interface';
import { WorkflowDefinition, WorkflowStep } from '../interfaces/workflow.interface';

@Injectable()
export class AgentOrchestrator implements IAgentOrchestrator {
  private readonly logger = new Logger(AgentOrchestrator.name);
  private readonly activeRequests = new Map<
    string,
    { organizationId: string; startedAt: string }
  >();

  constructor(
    private readonly planner: TaskPlannerService,
    private readonly coordinator: TaskCoordinator,
    private readonly delegation: TaskDelegationService,
    private readonly workflowManager: WorkflowManager,
    private readonly consensus: ConsensusEngine,
    private readonly sharedMemory: SharedMemoryService,
    private readonly agentRegistry: AgentRegistryService,
  ) {}

  async orchestrate(request: OrchestrationRequest): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const requestId = request.context.requestId;

    this.activeRequests.set(requestId, {
      organizationId: request.context.organizationId,
      startedAt: new Date().toISOString(),
    });

    try {
      const allAgents = this.agentRegistry.getAgentNames();
      const agentRequest: AgentRequest = {
        text: request.text,
        context: request.context,
        metadata: request.metadata,
      };

      const taskPlan = await this.planner.decompose(agentRequest, allAgents);

      if (request.workflowType && request.workflowType !== 'dag') {
        return await this.executeAsWorkflow(request, taskPlan, requestId, startTime);
      }

      const coordinationResult = await this.coordinator.coordinate({
        plan: taskPlan,
        context: request.context,
        timeout: request.timeout,
      });

      let consensusResult: OrchestrationResult['consensusResult'] = undefined;
      if (request.requireConsensus && coordinationResult.subtaskResults.length > 1) {
        consensusResult = await this.buildConsensus(coordinationResult.subtaskResults);
      }

      await this.sharedMemory.set(
        `orchestration:${requestId}`,
        { request: request.text, result: coordinationResult },
        {
          organizationId: request.context.organizationId,
          scope: 'workflow',
          tags: ['orchestration', requestId],
          createdBy: 'orchestrator',
        },
      );

      this.activeRequests.delete(requestId);

      const duration = Date.now() - startTime;
      const agentResults = coordinationResult.subtaskResults.map((r) => ({
        agentName: r.agentName,
        success: r.success,
        summary: r.error || `Completed in ${r.duration}ms`,
        duration: r.duration,
      }));

      return {
        success: coordinationResult.success,
        summary: coordinationResult.success
          ? `Orchestration completed: ${coordinationResult.subtaskResults.length} subtasks in ${duration}ms`
          : `Orchestration failed: ${coordinationResult.error || 'Unknown error'}`,
        duration,
        agentResults,
        consensusResult,
        requestId,
      };
    } catch (error) {
      this.activeRequests.delete(requestId);
      return {
        success: false,
        summary: `Orchestration failed: ${(error as Error).message}`,
        duration: Date.now() - startTime,
        agentResults: [],
        error: (error as Error).message,
        requestId,
      };
    }
  }

  async orchestrateWithAgents(
    request: OrchestrationRequest,
    agentNames: string[],
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const requestId = request.context.requestId;

    const agentResults: OrchestrationResult['agentResults'] = [];
    let allSuccessful = true;

    for (const agentName of agentNames) {
      const agentStart = Date.now();
      try {
        const agent = this.agentRegistry.get(agentName);
        if (!agent) {
          agentResults.push({
            agentName,
            success: false,
            summary: `Agent "${agentName}" not found`,
            duration: Date.now() - agentStart,
          });
          allSuccessful = false;
          continue;
        }

        const agentRequest: AgentRequest = {
          text: request.text,
          context: request.context,
          metadata: { ...request.metadata, agentName },
        };

        const response = await agent.execute(agentRequest);
        agentResults.push({
          agentName,
          success: response.success,
          summary: response.summary,
          duration: Date.now() - agentStart,
        });

        if (!response.success) allSuccessful = false;
      } catch (error) {
        agentResults.push({
          agentName,
          success: false,
          summary: (error as Error).message,
          duration: Date.now() - agentStart,
        });
        allSuccessful = false;
      }
    }

    let consensusResult: OrchestrationResult['consensusResult'] = undefined;
    if (request.requireConsensus && agentResults.length > 1) {
      consensusResult = await this.buildConsensus(
        agentResults.map((r) => ({
          agentName: r.agentName,
          agentName_: r.agentName,
          success: r.success,
          data: r.summary,
          duration: r.duration,
        })),
      );
    }

    return {
      success: allSuccessful,
      summary: allSuccessful
        ? `All ${agentNames.length} agents completed successfully`
        : `${agentResults.filter((r) => r.success).length}/${agentNames.length} agents succeeded`,
      duration: Date.now() - startTime,
      agentResults,
      consensusResult,
      requestId,
    };
  }

  async cancel(organizationId: string, requestId: string): Promise<boolean> {
    return this.activeRequests.delete(requestId);
  }

  getActiveOrchestrations(organizationId: string): string[] {
    return [...this.activeRequests.entries()]
      .filter(([, v]) => v.organizationId === organizationId)
      .map(([k]) => k);
  }

  private async executeAsWorkflow(
    request: OrchestrationRequest,
    taskPlan: import('../interfaces/planner.interface').TaskPlan,
    requestId: string,
    startTime: number,
  ): Promise<OrchestrationResult> {
    const steps: WorkflowStep[] = taskPlan.decomposition.subtasks.map((t) => ({
      id: t.id,
      name: t.description,
      agentName: t.agentName,
      capability: t.capability,
      input: t.input,
      dependsOn: t.dependsOn,
      priority: t.priority,
      timeout: t.timeout,
    }));

    const workflowDef: WorkflowDefinition = {
      id: requestId,
      name: `Orchestration ${requestId}`,
      description: request.text.substring(0, 200),
      type: request.workflowType || 'dag',
      steps,
      timeout: request.timeout,
    };

    await this.workflowManager.createWorkflow(workflowDef);
    const success = await this.workflowManager.executeWorkflow(requestId, request.context);

    const context = this.workflowManager.getWorkflowStatus(requestId);
    const agentResults = steps.map((s) => {
      const stepResult = context?.stepResults.get(s.id) as
        { success?: boolean; summary?: string; duration?: number } | undefined;
      return {
        agentName: s.agentName || 'unknown',
        success: stepResult?.success !== false,
        summary: stepResult?.summary || '',
        duration: stepResult?.duration || 0,
      };
    });

    this.activeRequests.delete(requestId);

    return {
      success,
      summary: success ? 'Workflow orchestration completed' : 'Workflow orchestration failed',
      duration: Date.now() - startTime,
      agentResults,
      requestId,
    };
  }

  private async buildConsensus(
    results: Array<{ success: boolean; data?: unknown; duration: number }>,
  ): Promise<OrchestrationResult['consensusResult']> {
    const votes = results
      .filter((r) => r.success)
      .map((r, i) => ({
        agentName: `agent-${i}`,
        choice: JSON.stringify(r.data),
        confidence: 0.8,
        weight: 1,
      }));

    if (votes.length === 0) {
      return { reached: false, confidence: 0, votes: [] };
    }

    const consensusResult = await this.consensus.evaluate({
      question: 'Aggregate agent responses',
      options: votes.map((v) => v.choice),
      votes,
      weightStrategy: 'equal',
      organizationId: '',
    });

    return {
      reached: consensusResult.reached,
      confidence: consensusResult.confidence,
      votes: consensusResult.votes.map((v) => ({
        agentName: v.agentName,
        choice: v.choice,
        confidence: v.confidence,
      })),
    };
  }
}
