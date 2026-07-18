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
export class ReportingAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    name: 'reporting',
    description:
      'Business reporting agent. Generates cross-domain reports, dashboards, and data exports.',
    version: '1.0.0',
    capabilities: [
      {
        name: 'report-generation',
        description: 'Generates structured business reports across domains',
        confidence: 0.95,
      },
      {
        name: 'data-export',
        description: 'Exports data in CSV, Excel, or PDF formats',
        confidence: 0.9,
      },
      {
        name: 'dashboard-insights',
        description: 'Provides dashboard summaries and KPI tracking',
        confidence: 0.85,
      },
      {
        name: 'cross-domain-reporting',
        description: 'Combines data from multiple domains into unified reports',
        confidence: 0.8,
      },
    ],
    requiredTools: ['getSalesTotal', 'getStockLevel', 'getActiveEmployees', 'getFinancialSummary'],
    supportedProviders: ['openai', 'claude', 'gemini'],
    priority: 4,
    promptName: 'reporting-agent',
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
      text.includes('report') ||
      (text.includes('generate') && (text.includes('report') || text.includes('export')))
    ) {
      return {
        name: 'report-generation',
        description: 'Generates structured business reports across domains',
        confidence: 0.95,
      };
    }
    if (
      text.includes('export') ||
      text.includes('csv') ||
      text.includes('excel') ||
      text.includes('download') ||
      text.includes('pdf')
    ) {
      return {
        name: 'data-export',
        description: 'Exports data in CSV, Excel, or PDF formats',
        confidence: 0.9,
      };
    }
    if (
      text.includes('dashboard') ||
      text.includes('kpi') ||
      text.includes('metric') ||
      text.includes('performance indicator')
    ) {
      return {
        name: 'dashboard-insights',
        description: 'Provides dashboard summaries and KPI tracking',
        confidence: 0.85,
      };
    }
    if (
      (text.includes('all') ||
        text.includes('everything') ||
        text.includes('combined') ||
        text.includes('unified')) &&
      (text.includes('report') || text.includes('data') || text.includes('summary'))
    ) {
      return {
        name: 'cross-domain-reporting',
        description: 'Combines data from multiple domains into unified reports',
        confidence: 0.8,
      };
    }
    return null;
  }

  async plan(request: AgentRequest): Promise<AgentExecutionPlan> {
    const text = request.text.toLowerCase();
    const steps: AgentExecutionStep[] = [];
    const planId = `rpt-${Date.now().toString(36)}`;

    const includesSales =
      text.includes('sales') || text.includes('revenue') || text.includes('customer');
    const includesInventory =
      text.includes('inventory') || text.includes('stock') || text.includes('warehouse');
    const includesFinance =
      text.includes('finance') || text.includes('account') || text.includes('payment');
    const includesHr =
      text.includes('hr') || text.includes('employee') || text.includes('attendance');
    const includeAll =
      text.includes('all') ||
      text.includes('everything') ||
      text.includes('full') ||
      text.includes('complete');

    if (includeAll || (!includesSales && !includesInventory && !includesFinance && !includesHr)) {
      if (steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        steps.push(
          this.createStep(
            'getSalesTotal',
            { customerId: 'all', period: 'current' },
            'Fetch sales data for report',
            lastStep ? [lastStep.stepId] : [],
          ),
        );
      } else {
        steps.push(
          this.createStep(
            'getSalesTotal',
            { customerId: 'all', period: 'current' },
            'Fetch sales data for report',
          ),
        );
      }
    } else {
      if (includesSales) {
        steps.push(
          this.createStep(
            'getSalesTotal',
            { customerId: 'all', period: 'current' },
            'Fetch sales data for report',
          ),
        );
      }
    }

    if (includeAll || includesInventory) {
      steps.push(
        this.createStep(
          'getStockLevel',
          { productId: 'all' },
          'Fetch inventory data for report',
          steps.length > 0 ? [steps[steps.length - 1].stepId] : [],
        ),
      );
    }

    if (includeAll || includesFinance) {
      steps.push(
        this.createStep(
          'getFinancialSummary',
          { period: 'current' },
          'Fetch financial data for report',
          steps.length > 0 ? [steps[steps.length - 1].stepId] : [],
        ),
      );
    }

    if (includeAll || includesHr) {
      steps.push(
        this.createStep(
          'getActiveEmployees',
          { departmentId: 'all' },
          'Fetch HR data for report',
          steps.length > 0 ? [steps[steps.length - 1].stepId] : [],
        ),
      );
    }

    return {
      planId,
      agentName: 'reporting',
      requestDescription: request.text.substring(0, 200),
      steps,
      estimatedComplexity: steps.length <= 2 ? 'simple' : steps.length <= 4 ? 'medium' : 'complex',
    };
  }
}
