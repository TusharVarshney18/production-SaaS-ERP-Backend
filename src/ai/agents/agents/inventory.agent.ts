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
export class InventoryAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    name: 'inventory',
    description:
      'Inventory management agent. Handles stock levels, warehouses, transfers, and procurement.',
    version: '1.0.0',
    capabilities: [
      {
        name: 'stock-query',
        description: 'Checks stock levels and availability',
        confidence: 0.95,
      },
      {
        name: 'warehouse-management',
        description: 'Handles warehouse information and status',
        confidence: 0.9,
      },
      {
        name: 'inventory-transfer',
        description: 'Manages inventory transfer operations',
        confidence: 0.85,
      },
      {
        name: 'procurement-insights',
        description: 'Provides purchase order and vendor information',
        confidence: 0.8,
      },
    ],
    requiredTools: [
      'getStockLevel',
      'getWarehouseStatus',
      'getTransferStatus',
      'getPurchaseOrderStatus',
    ],
    supportedProviders: ['openai', 'claude', 'gemini'],
    priority: 6,
    promptName: 'inventory-agent',
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
      text.includes('stock') ||
      text.includes('available') ||
      text.includes('in stock') ||
      text.includes('quantity')
    ) {
      return {
        name: 'stock-query',
        description: 'Checks stock levels and availability',
        confidence: 0.95,
      };
    }
    if (text.includes('warehouse') || text.includes('facility') || text.includes('location')) {
      return {
        name: 'warehouse-management',
        description: 'Handles warehouse information and status',
        confidence: 0.9,
      };
    }
    if (text.includes('transfer') || text.includes('move') || text.includes('relocate')) {
      return {
        name: 'inventory-transfer',
        description: 'Manages inventory transfer operations',
        confidence: 0.85,
      };
    }
    if (
      text.includes('purchase order') ||
      text.includes('vendor') ||
      text.includes('supplier') ||
      text.includes('procurement')
    ) {
      return {
        name: 'procurement-insights',
        description: 'Provides purchase order and vendor information',
        confidence: 0.8,
      };
    }
    if (text.includes('inventory') || text.includes('product') || text.includes('item')) {
      return {
        name: 'stock-query',
        description: 'Checks stock levels and availability',
        confidence: 0.7,
      };
    }
    return null;
  }

  async plan(request: AgentRequest): Promise<AgentExecutionPlan> {
    const text = request.text.toLowerCase();
    const steps: AgentExecutionStep[] = [];
    const planId = `inv-${Date.now().toString(36)}`;

    if (
      text.includes('stock') ||
      text.includes('available') ||
      text.includes('in stock') ||
      text.includes('quantity')
    ) {
      steps.push(
        this.createStep(
          'getStockLevel',
          { productId: request.metadata?.productId || 'all' },
          'Fetch stock level information',
        ),
      );
    }

    if (text.includes('warehouse')) {
      steps.push(
        this.createStep(
          'getWarehouseStatus',
          { warehouseId: request.metadata?.warehouseId || 'all' },
          'Fetch warehouse status',
        ),
      );
    }

    if (text.includes('transfer') || text.includes('move')) {
      steps.push(
        this.createStep(
          'getTransferStatus',
          { transferId: request.metadata?.transferId || 'all' },
          'Fetch inventory transfer information',
        ),
      );
    }

    if (
      text.includes('purchase order') ||
      text.includes('vendor') ||
      text.includes('supplier') ||
      text.includes('procurement')
    ) {
      steps.push(
        this.createStep(
          'getPurchaseOrderStatus',
          { filter: text.includes('pending') ? 'pending' : 'all' },
          'Fetch purchase order information',
        ),
      );
    }

    if (steps.length === 0) {
      steps.push(
        this.createStep('getStockLevel', { productId: 'all' }, 'Fetch inventory overview'),
      );
    }

    return {
      planId,
      agentName: 'inventory',
      requestDescription: request.text.substring(0, 200),
      steps,
      estimatedComplexity: steps.length <= 2 ? 'simple' : 'medium',
    };
  }
}
