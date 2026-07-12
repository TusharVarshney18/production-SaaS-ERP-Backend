import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { EventBusService } from '../events/event-bus.service';
import { WorkflowEngineService } from '../engine/workflow-engine.service';

describe('EventBusService', () => {
  let service: EventBusService;
  let engine: DeepMockProxy<WorkflowEngineService>;

  beforeEach(() => {
    engine = mockDeep<WorkflowEngineService>();
    service = new EventBusService(engine as unknown as WorkflowEngineService);
  });

  it('should emit event to workflow engine', async () => {
    (engine.processEvent as jest.Mock).mockResolvedValue(undefined);
    await service.emit({
      organizationId: 'org-1',
      event: 'InvoicePaid',
      resourceId: 'inv-1',
      occurredAt: new Date(),
    });
    expect(engine.processEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'InvoicePaid', organizationId: 'org-1' }),
    );
  });

  it('should not throw on engine error', async () => {
    (engine.processEvent as jest.Mock).mockRejectedValue(new Error('Engine error'));
    await expect(
      service.emit({
        organizationId: 'org-1',
        event: 'InvoicePaid',
        resourceId: 'inv-1',
        occurredAt: new Date(),
      }),
    ).resolves.not.toThrow();
  });
});
