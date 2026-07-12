import { WorkflowAction } from '@prisma/client';
import { ActionRegistryService } from '../actions/action-registry.service';

describe('ActionRegistryService', () => {
  let service: ActionRegistryService;

  beforeEach(() => {
    service = new ActionRegistryService();
  });

  const mockEvent = {
    organizationId: 'org-1',
    event: 'InvoicePaid' as const,
    resourceId: 'inv-1',
    occurredAt: new Date(),
  };

  function makeAction(overrides: Record<string, unknown> = {}): WorkflowAction {
    return {
      id: 'a1',
      type: 'NOTIFICATION' as never,
      config: {},
      order: 0,
      workflowDefinitionId: 'wf-1',
      ...overrides,
    } as unknown as WorkflowAction;
  }

  it('should register and execute handlers', async () => {
    const mockHandler = { type: 'TEST', execute: jest.fn().mockResolvedValue({ done: true }) };
    service.register(mockHandler);

    const result = await service.execute(makeAction({ type: 'TEST' }), mockEvent);
    expect(result).toEqual({ done: true });
  });

  it('should throw for unregistered handler', async () => {
    await expect(service.execute(makeAction({ type: 'UNKNOWN' }), mockEvent)).rejects.toThrow(
      'No handler registered for action type: UNKNOWN',
    );
  });
});
