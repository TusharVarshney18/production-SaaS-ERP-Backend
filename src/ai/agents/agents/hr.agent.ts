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
export class HrAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    name: 'hr',
    description:
      'Human resources agent. Handles employee information, attendance, leave, and department data.',
    version: '1.0.0',
    capabilities: [
      {
        name: 'employee-info',
        description: 'Provides employee details and directory',
        confidence: 0.95,
      },
      {
        name: 'attendance-tracking',
        description: 'Handles attendance records and status',
        confidence: 0.9,
      },
      {
        name: 'leave-management',
        description: 'Manages leave requests and balances',
        confidence: 0.9,
      },
      {
        name: 'department-insights',
        description: 'Provides department structure and headcount',
        confidence: 0.85,
      },
    ],
    requiredTools: [
      'getActiveEmployees',
      'getAttendanceRecord',
      'getLeaveBalance',
      'getDepartmentInfo',
    ],
    supportedProviders: ['openai', 'claude', 'gemini'],
    priority: 5,
    promptName: 'hr-agent',
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
      text.includes('employee') ||
      text.includes('staff') ||
      text.includes('personnel') ||
      text.includes('who is')
    ) {
      return {
        name: 'employee-info',
        description: 'Provides employee details and directory',
        confidence: 0.95,
      };
    }
    if (
      text.includes('attendance') ||
      text.includes('check in') ||
      text.includes('check out') ||
      text.includes('present')
    ) {
      return {
        name: 'attendance-tracking',
        description: 'Handles attendance records and status',
        confidence: 0.9,
      };
    }
    if (
      text.includes('leave') ||
      text.includes('vacation') ||
      text.includes('time off') ||
      text.includes('sick')
    ) {
      return {
        name: 'leave-management',
        description: 'Manages leave requests and balances',
        confidence: 0.9,
      };
    }
    if (
      text.includes('department') ||
      text.includes('team') ||
      text.includes('org chart') ||
      text.includes('reporting')
    ) {
      return {
        name: 'department-insights',
        description: 'Provides department structure and headcount',
        confidence: 0.85,
      };
    }
    if (text.includes('hr') || text.includes('human resource')) {
      return {
        name: 'employee-info',
        description: 'Provides employee details and directory',
        confidence: 0.7,
      };
    }
    return null;
  }

  async plan(request: AgentRequest): Promise<AgentExecutionPlan> {
    const text = request.text.toLowerCase();
    const steps: AgentExecutionStep[] = [];
    const planId = `hr-${Date.now().toString(36)}`;

    if (
      text.includes('employee') ||
      text.includes('staff') ||
      text.includes('personnel') ||
      text.includes('who is')
    ) {
      steps.push(
        this.createStep(
          'getActiveEmployees',
          { departmentId: request.metadata?.departmentId || 'all' },
          'Fetch employee information',
        ),
      );
    }

    if (text.includes('attendance') || text.includes('present') || text.includes('absent')) {
      steps.push(
        this.createStep(
          'getAttendanceRecord',
          { period: request.metadata?.period || 'current' },
          'Fetch attendance records',
        ),
      );
    }

    if (
      text.includes('leave') ||
      text.includes('vacation') ||
      text.includes('time off') ||
      text.includes('sick')
    ) {
      steps.push(
        this.createStep(
          'getLeaveBalance',
          { employeeId: request.metadata?.employeeId || 'all' },
          'Fetch leave balance information',
        ),
      );
    }

    if (text.includes('department') || text.includes('team') || text.includes('org chart')) {
      steps.push(
        this.createStep('getDepartmentInfo', { departmentId: 'all' }, 'Fetch department structure'),
      );
    }

    if (steps.length === 0) {
      steps.push(
        this.createStep('getActiveEmployees', { departmentId: 'all' }, 'Fetch employee overview'),
      );
    }

    return {
      planId,
      agentName: 'hr',
      requestDescription: request.text.substring(0, 200),
      steps,
      estimatedComplexity: steps.length <= 2 ? 'simple' : 'medium',
    };
  }
}
