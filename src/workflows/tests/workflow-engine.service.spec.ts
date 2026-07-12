import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionRegistryService } from '../actions/action-registry.service';
import { WorkflowDefinitionsService } from '../services/workflow-definitions.service';

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;
  let prisma: DeepMockProxy<PrismaService>;
  let definitions: DeepMockProxy<WorkflowDefinitionsService>;
  let actionRegistry: DeepMockProxy<ActionRegistryService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    definitions = mockDeep<WorkflowDefinitionsService>();
    actionRegistry = mockDeep<ActionRegistryService>();
    service = new WorkflowEngineService(
      prisma,
      definitions as unknown as WorkflowDefinitionsService,
      actionRegistry as unknown as ActionRegistryService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  const mockEvent = {
    organizationId: 'org-1',
    event: 'InvoicePaid' as const,
    resourceId: 'inv-1',
    data: { amount: 5000 },
    occurredAt: new Date(),
  };

  describe('processEvent', () => {
    it('should execute matching workflows', async () => {
      (definitions.findByEvent as jest.Mock).mockResolvedValue([
        {
          id: 'wf-1',
          name: 'Notify on Payment',
          event: 'InvoicePaid',
          conditions: null,
          isActive: true,
          actions: [
            { id: 'act-1', type: 'NOTIFICATION', config: { title: 'Payment Received' }, order: 0 },
          ],
        },
      ]);
      (prisma.workflowExecutionLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });
      (prisma.workflowExecutionLog.update as jest.Mock).mockResolvedValue({});
      (actionRegistry.execute as jest.Mock).mockResolvedValue({ created: true });

      await service.processEvent(mockEvent);

      expect(definitions.findByEvent).toHaveBeenCalledWith('org-1', 'InvoicePaid');
      expect(actionRegistry.execute).toHaveBeenCalled();
    });

    it('should do nothing when no workflows match', async () => {
      (definitions.findByEvent as jest.Mock).mockResolvedValue([]);
      await service.processEvent(mockEvent);
      expect(prisma.workflowExecutionLog.create).not.toHaveBeenCalled();
    });
  });
});
