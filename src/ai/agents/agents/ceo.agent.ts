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
export class CeoAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    name: 'ceo',
    description:
      'Executive oversight agent. Summarizes business-wide insights across sales, finance, inventory, HR, and reporting.',
    version: '1.0.0',
    capabilities: [
      {
        name: 'executive-overview',
        description: 'Provides business-wide dashboard and KPI summaries',
        confidence: 0.95,
      },
      {
        name: 'cross-domain-query',
        description: 'Answers questions spanning multiple business domains',
        confidence: 0.85,
      },
      {
        name: 'business-intelligence',
        description: 'Analyses trends and provides strategic recommendations',
        confidence: 0.8,
      },
    ],
    requiredTools: ['getSalesTotal', 'getStockLevel', 'getActiveEmployees', 'getFinancialSummary'],
    supportedProviders: ['openai', 'claude', 'gemini'],
    priority: 10,
    promptName: 'ceo-agent',
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
      text.includes('dashboard') ||
      text.includes('overview') ||
      text.includes('business health') ||
      text.includes('summary') ||
      text.includes('executive')
    ) {
      return {
        name: 'executive-overview',
        description: 'Provides business-wide dashboard and KPI summaries',
        confidence: 0.95,
      };
    }
    if (
      (text.includes('revenue') && text.includes('inventory')) ||
      (text.includes('sales') && text.includes('stock')) ||
      (text.includes('cross') && text.includes('domain'))
    ) {
      return {
        name: 'cross-domain-query',
        description: 'Answers questions spanning multiple business domains',
        confidence: 0.85,
      };
    }
    return null;
  }

  async plan(request: AgentRequest): Promise<AgentExecutionPlan> {
    const text = request.text.toLowerCase();
    const steps: AgentExecutionStep[] = [];
    const planId = `ceo-${Date.now().toString(36)}`;

    if (text.includes('revenue') || text.includes('sales') || text.includes('financial')) {
      steps.push(this.createStep('getSalesTotal', { customerId: 'all' }, 'Fetch total sales data'));
      steps.push(
        this.createStep(
          'getFinancialSummary',
          { period: 'current' },
          'Fetch financial summary',
          [steps[steps.length - 1]?.stepId].filter(Boolean),
        ),
      );
    }

    if (text.includes('inventory') || text.includes('stock') || text.includes('warehouse')) {
      steps.push(
        this.createStep('getStockLevel', { productId: 'all' }, 'Fetch inventory stock levels'),
      );
    }

    if (text.includes('employee') || text.includes('hr') || text.includes('workforce')) {
      steps.push(
        this.createStep(
          'getActiveEmployees',
          { departmentId: 'all' },
          'Fetch active employee count',
        ),
      );
    }

    if (steps.length === 0) {
      steps.push(
        this.createStep('getFinancialSummary', { period: 'current' }, 'Fetch business overview'),
      );
    }

    return {
      planId,
      agentName: 'ceo',
      requestDescription: request.text.substring(0, 200),
      steps,
      estimatedComplexity: steps.length <= 2 ? 'simple' : steps.length <= 4 ? 'medium' : 'complex',
    };
  }
}
