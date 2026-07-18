import { TaskPlannerService } from '../planner/task-planner.service';
import { AgentRegistryService } from '../../agents/registry/agent-registry.service';
import { Test, TestingModule } from '@nestjs/testing';

describe('TaskPlannerService', () => {
  let planner: TaskPlannerService;
  let agentRegistry: AgentRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskPlannerService, AgentRegistryService],
    }).compile();

    planner = module.get<TaskPlannerService>(TaskPlannerService);
    agentRegistry = module.get<AgentRegistryService>(AgentRegistryService);
  });

  it('should decompose a request into subtasks', async () => {
    const plan = await planner.decompose(
      { text: 'Compare sales and inventory performance', context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any },
      ['sales', 'finance', 'hr'],
    );

    expect(plan.planId).toBeDefined();
    expect(plan.decomposition.subtasks.length).toBeGreaterThan(0);
    expect(plan.decomposition.description).toContain('Compare');
  });

  it('should handle empty agent list', async () => {
    const plan = await planner.decompose(
      { text: 'Do something', context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any },
      [],
    );

    expect(plan.decomposition.subtasks.length).toBe(1);
  });

  it('should validate a valid plan', async () => {
    const plan = await planner.decompose(
      { text: 'Test request', context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any },
      ['sales'],
    );

    const errors = await planner.validatePlan(plan);
    expect(errors.length).toBe(0);
  });

  it('should detect missing planId', async () => {
    const plan = await planner.decompose(
      { text: 'Test', context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any },
      ['sales'],
    );
    (plan as any).planId = '';

    const errors = await planner.validatePlan(plan);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should get execution order for independent tasks', async () => {
    const plan = await planner.decompose(
      { text: 'Get all data', context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any },
      ['sales', 'finance', 'hr'],
    );

    const order = planner.getExecutionOrder(plan);
    expect(order.length).toBeGreaterThan(0);
  });

  it('should estimate complexity', () => {
    const { TaskPlannerService: TPS } = require('../planner/task-planner.service');
    const plannerLocal = new TPS(agentRegistry);
    expect(plannerLocal.estimateComplexity([{ id: '1' } as any])).toBe('simple');
    expect(plannerLocal.estimateComplexity([{ id: '1' }, { id: '2' }, { id: '3' }] as any)).toBe('medium');
    expect(plannerLocal.estimateComplexity([{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }] as any)).toBe('complex');
  });
});
