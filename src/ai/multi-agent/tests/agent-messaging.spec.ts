import { AgentMessagingService } from '../messaging/agent-messaging.service';
import { AgentMessage } from '../interfaces/messaging.interface';

describe('AgentMessagingService', () => {
  let service: AgentMessagingService;

  beforeEach(() => {
    service = new AgentMessagingService();
  });

  it('should send a message to an agent', async () => {
    const msg: AgentMessage = {
      envelope: {
        messageId: 'm1',
        correlationId: 'c1',
        type: 'request',
        priority: 'normal',
        sourceAgent: 'ceo',
        targetAgent: 'sales',
        timestamp: new Date().toISOString(),
      },
      payload: { action: 'getSalesData' },
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    };

    await service.send(msg);
    const pending = service.getPendingMessages('sales');
    expect(pending.length).toBe(1);
    expect(pending[0].payload).toEqual({ action: 'getSalesData' });
  });

  it('should broadcast to multiple agents', async () => {
    await service.broadcast({
      payload: { alert: 'test' },
      targetAgents: ['sales', 'finance', 'hr'],
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    });

    expect(service.getPendingMessages('sales').length).toBe(1);
    expect(service.getPendingMessages('finance').length).toBe(1);
    expect(service.getPendingMessages('hr').length).toBe(1);
  });

  it('should acknowledge a message', async () => {
    const msg: AgentMessage = {
      envelope: {
        messageId: '',
        correlationId: 'c1',
        type: 'request',
        priority: 'normal',
        sourceAgent: 'ceo',
        targetAgent: 'sales',
        timestamp: new Date().toISOString(),
      },
      payload: 'test',
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    };

    await service.send(msg);
    const pending = service.getPendingMessages('sales');
    expect(pending.length).toBe(1);
    expect(service.acknowledge(pending[0].envelope.messageId)).toBe(true);
    expect(service.getPendingMessages('sales').length).toBe(0);
  });

  it('should publish and subscribe to events', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    service.subscribe('task.completed', handler);

    await service.publishEvent('task.completed', { taskId: 't1' }, {
      organizationId: 'org-1',
      userId: 'u1',
      requestId: 'r1',
    } as any);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe from events', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    service.subscribe('task.completed', handler);
    service.unsubscribe('task.completed', handler);

    await service.publishEvent('task.completed', { taskId: 't1' }, {
      organizationId: 'org-1',
      userId: 'u1',
      requestId: 'r1',
    } as any);

    expect(handler).not.toHaveBeenCalled();
  });
});
