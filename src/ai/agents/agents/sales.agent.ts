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
export class SalesAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    name: 'sales',
    description:
      'Sales operations agent. Handles quotations, orders, customers, and sales performance.',
    version: '1.0.0',
    capabilities: [
      {
        name: 'sales-analysis',
        description: 'Analyses sales performance and trends',
        confidence: 0.95,
      },
      {
        name: 'quotation-management',
        description: 'Handles quotation creation and tracking',
        confidence: 0.9,
      },
      { name: 'order-management', description: 'Manages sales order lifecycle', confidence: 0.9 },
      {
        name: 'customer-insights',
        description: 'Provides customer information and history',
        confidence: 0.85,
      },
    ],
    requiredTools: [
      'getSalesTotal',
      'getQuotationStatus',
      'getOrderStatus',
      'getCustomerInfo',
      'getTopProducts',
    ],
    supportedProviders: ['openai', 'claude', 'gemini'],
    priority: 7,
    promptName: 'sales-agent',
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
    if (text.includes('quotation') || text.includes('quote') || text.includes('estimate')) {
      return {
        name: 'quotation-management',
        description: 'Handles quotation creation and tracking',
        confidence: 0.9,
      };
    }
    if (text.includes('order') || text.includes('sales order')) {
      return {
        name: 'order-management',
        description: 'Manages sales order lifecycle',
        confidence: 0.9,
      };
    }
    if (text.includes('customer') || text.includes('client')) {
      return {
        name: 'customer-insights',
        description: 'Provides customer information and history',
        confidence: 0.85,
      };
    }
    if (
      text.includes('sales') ||
      text.includes('top product') ||
      text.includes('best selling') ||
      text.includes('sales performance')
    ) {
      return {
        name: 'sales-analysis',
        description: 'Analyses sales performance and trends',
        confidence: 0.95,
      };
    }
    return null;
  }

  async plan(request: AgentRequest): Promise<AgentExecutionPlan> {
    const text = request.text.toLowerCase();
    const steps: AgentExecutionStep[] = [];
    const planId = `sls-${Date.now().toString(36)}`;

    if (text.includes('sales') || text.includes('revenue') || text.includes('performance')) {
      steps.push(
        this.createStep(
          'getSalesTotal',
          { customerId: 'all', period: 'current' },
          'Fetch total sales data',
        ),
      );
      steps.push(
        this.createStep(
          'getTopProducts',
          { limit: 10, period: 'current' },
          'Fetch top selling products',
          [steps[0].stepId],
        ),
      );
    }

    if (text.includes('quotation') || text.includes('quote')) {
      steps.push(
        this.createStep(
          'getQuotationStatus',
          { filter: text.includes('pending') ? 'pending' : 'all' },
          'Fetch quotation information',
        ),
      );
    }

    if (text.includes('order')) {
      steps.push(
        this.createStep(
          'getOrderStatus',
          {
            filter: text.includes('pending')
              ? 'pending'
              : text.includes('completed')
                ? 'completed'
                : 'all',
          },
          'Fetch sales order information',
        ),
      );
    }

    if (text.includes('customer') || text.includes('client')) {
      steps.push(
        this.createStep(
          'getCustomerInfo',
          { customerId: request.metadata?.customerId || 'all' },
          'Fetch customer information',
        ),
      );
    }

    if (steps.length === 0) {
      steps.push(
        this.createStep(
          'getSalesTotal',
          { customerId: 'all', period: 'current' },
          'Fetch sales overview',
        ),
      );
    }

    return {
      planId,
      agentName: 'sales',
      requestDescription: request.text.substring(0, 200),
      steps,
      estimatedComplexity: steps.length <= 2 ? 'simple' : 'medium',
    };
  }
}
