import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import {
  AgentMetadata,
  AgentCapability,
  AgentRequest,
  AgentExecutionPlan,
  AgentExecutionStep,
} from '../interfaces/agent.interface';
import { PromptRegistryService } from '../../registry/prompt-registry.service';
import { ToolRegistryService } from '../../registry/tool-registry.service';
import { ExecutionPipelineService } from '../../tools/execution/execution-pipeline.service';

@Injectable()
export class DeveloperAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    name: 'developer',
    description:
      'Developer operations agent. Handles API documentation, system status, audit logs, and configuration queries.',
    version: '1.0.0',
    capabilities: [
      {
        name: 'system-status',
        description: 'Checks system health and provider availability',
        confidence: 0.95,
      },
      {
        name: 'api-insights',
        description: 'Provides API documentation and endpoint information',
        confidence: 0.9,
      },
      {
        name: 'audit-query',
        description: 'Queries audit logs and system events',
        confidence: 0.85,
      },
      {
        name: 'configuration-lookup',
        description: 'Retrieves system configuration values',
        confidence: 0.8,
      },
    ],
    requiredTools: ['getSystemHealth', 'getApiEndpoints', 'getAuditLogs', 'getProviderStatus'],
    supportedProviders: ['openai', 'claude', 'gemini'],
    priority: 3,
    promptName: 'developer-agent',
  };

  constructor(
    promptRegistry: PromptRegistryService,
    toolRegistry: ToolRegistryService,
    executionPipeline: ExecutionPipelineService,
  ) {
    super(promptRegistry, toolRegistry, executionPipeline);
  }

  async canHandle(request: AgentRequest): Promise<AgentCapability | null> {
    const text = request.text.toLowerCase();
    if (
      text.includes('system health') ||
      text.includes('status') ||
      text.includes('uptime') ||
      (text.includes('provider') && text.includes('available'))
    ) {
      return {
        name: 'system-status',
        description: 'Checks system health and provider availability',
        confidence: 0.95,
      };
    }
    if (
      text.includes('api') ||
      text.includes('endpoint') ||
      text.includes('route') ||
      text.includes('swagger')
    ) {
      return {
        name: 'api-insights',
        description: 'Provides API documentation and endpoint information',
        confidence: 0.9,
      };
    }
    if (
      text.includes('audit') ||
      text.includes('log') ||
      text.includes('event') ||
      text.includes('history')
    ) {
      return {
        name: 'audit-query',
        description: 'Queries audit logs and system events',
        confidence: 0.85,
      };
    }
    if (
      text.includes('config') ||
      text.includes('setting') ||
      text.includes('environment') ||
      text.includes('variable')
    ) {
      return {
        name: 'configuration-lookup',
        description: 'Retrieves system configuration values',
        confidence: 0.8,
      };
    }
    if (
      text.includes('developer') ||
      text.includes('dev') ||
      text.includes('technical') ||
      text.includes('debug')
    ) {
      return {
        name: 'system-status',
        description: 'Checks system health and provider availability',
        confidence: 0.7,
      };
    }
    return null;
  }

  async plan(request: AgentRequest): Promise<AgentExecutionPlan> {
    const text = request.text.toLowerCase();
    const steps: AgentExecutionStep[] = [];
    const planId = `dev-${Date.now().toString(36)}`;

    if (
      text.includes('system health') ||
      text.includes('status') ||
      text.includes('uptime') ||
      (text.includes('provider') && text.includes('available'))
    ) {
      steps.push(
        this.createStep(
          'getSystemHealth',
          { detailed: text.includes('detailed') || text.includes('all') },
          'Check system health status',
        ),
      );
      steps.push(
        this.createStep(
          'getProviderStatus',
          { provider: request.metadata?.provider || 'all' },
          'Check AI provider status',
          [steps[0].stepId],
        ),
      );
    }

    if (text.includes('api') || text.includes('endpoint') || text.includes('route')) {
      steps.push(
        this.createStep(
          'getApiEndpoints',
          { filter: request.metadata?.filter || 'all' },
          'Fetch API endpoint information',
        ),
      );
    }

    if (text.includes('audit') || text.includes('log') || text.includes('event')) {
      steps.push(
        this.createStep(
          'getAuditLogs',
          { limit: 50, eventType: request.metadata?.eventType || undefined },
          'Query audit logs',
        ),
      );
    }

    if (text.includes('config') || text.includes('setting')) {
      steps.push(
        this.createStep('getSystemHealth', { detailed: true }, 'Fetch system configuration'),
      );
    }

    if (steps.length === 0) {
      steps.push(this.createStep('getSystemHealth', { detailed: false }, 'Fetch system overview'));
    }

    return {
      planId,
      agentName: 'developer',
      requestDescription: request.text.substring(0, 200),
      steps,
      estimatedComplexity: steps.length <= 2 ? 'simple' : 'medium',
    };
  }
}
