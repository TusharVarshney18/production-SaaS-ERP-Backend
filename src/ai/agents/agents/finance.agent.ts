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
export class FinanceAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    name: 'finance',
    description:
      'Financial operations agent. Handles revenue, expenses, invoices, payments, and accounting queries.',
    version: '1.0.0',
    capabilities: [
      {
        name: 'revenue-analysis',
        description: 'Analyses revenue data and trends',
        confidence: 0.95,
      },
      {
        name: 'invoice-management',
        description: 'Handles invoice queries and status',
        confidence: 0.9,
      },
      {
        name: 'payment-tracking',
        description: 'Tracks payments and reconciliations',
        confidence: 0.9,
      },
      {
        name: 'financial-reporting',
        description: 'Generates financial reports and statements',
        confidence: 0.85,
      },
    ],
    requiredTools: [
      'getSalesTotal',
      'getFinancialSummary',
      'getInvoiceStatus',
      'getPaymentHistory',
    ],
    supportedProviders: ['openai', 'claude', 'gemini'],
    priority: 8,
    promptName: 'finance-agent',
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
      text.includes('revenue') ||
      text.includes('income') ||
      text.includes('earning') ||
      text.includes('profit')
    ) {
      return {
        name: 'revenue-analysis',
        description: 'Analyses revenue data and trends',
        confidence: 0.95,
      };
    }
    if (text.includes('invoice') || text.includes('bill') || text.includes('billing')) {
      return {
        name: 'invoice-management',
        description: 'Handles invoice queries and status',
        confidence: 0.9,
      };
    }
    if (
      text.includes('payment') ||
      text.includes('paid') ||
      text.includes('transaction') ||
      text.includes('reconciliation')
    ) {
      return {
        name: 'payment-tracking',
        description: 'Tracks payments and reconciliations',
        confidence: 0.9,
      };
    }
    if (
      text.includes('balance sheet') ||
      text.includes('p&l') ||
      text.includes('profit and loss') ||
      text.includes('financial report') ||
      text.includes('trial balance')
    ) {
      return {
        name: 'financial-reporting',
        description: 'Generates financial reports and statements',
        confidence: 0.85,
      };
    }
    if (
      text.includes('account') ||
      text.includes('finance') ||
      text.includes('financial') ||
      text.includes('money')
    ) {
      return {
        name: 'financial-reporting',
        description: 'Generates financial reports and statements',
        confidence: 0.7,
      };
    }
    return null;
  }

  async plan(request: AgentRequest): Promise<AgentExecutionPlan> {
    const text = request.text.toLowerCase();
    const steps: AgentExecutionStep[] = [];
    const planId = `fin-${Date.now().toString(36)}`;

    if (text.includes('revenue') || text.includes('income')) {
      steps.push(
        this.createStep(
          'getSalesTotal',
          { customerId: 'all', period: 'current' },
          'Fetch current revenue data',
        ),
      );
    }

    if (text.includes('invoice') || text.includes('bill')) {
      steps.push(
        this.createStep(
          'getInvoiceStatus',
          { filter: text.includes('pending') ? 'pending' : 'all' },
          'Fetch invoice status information',
        ),
      );
    }

    if (
      text.includes('payment') ||
      text.includes('transaction') ||
      text.includes('reconciliation')
    ) {
      steps.push(this.createStep('getPaymentHistory', { limit: 50 }, 'Fetch payment history'));
    }

    if (
      text.includes('balance') ||
      text.includes('p&l') ||
      text.includes('financial report') ||
      text.includes('trial balance')
    ) {
      steps.push(
        this.createStep(
          'getFinancialSummary',
          { period: 'current', type: text.includes('balance') ? 'balance-sheet' : 'pnl' },
          'Generate financial report',
        ),
      );
    }

    if (steps.length === 0) {
      steps.push(
        this.createStep('getFinancialSummary', { period: 'current' }, 'Fetch financial overview'),
      );
    }

    return {
      planId,
      agentName: 'finance',
      requestDescription: request.text.substring(0, 200),
      steps,
      estimatedComplexity: steps.length <= 2 ? 'simple' : 'medium',
    };
  }
}
