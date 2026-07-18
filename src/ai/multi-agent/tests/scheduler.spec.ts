import { ExecutionScheduler } from '../scheduler/execution-scheduler.service';

describe('ExecutionScheduler', () => {
  let scheduler: ExecutionScheduler;

  beforeEach(() => {
    scheduler = new ExecutionScheduler();
  });

  it('should schedule a task', async () => {
    const id = await scheduler.schedule({
      name: 'test-task',
      input: { data: 'test' },
      options: { priority: 'normal' },
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    });

    expect(id).toBeDefined();
    const task = scheduler.getStatus(id);
    expect(task).toBeDefined();
    expect(task!.name).toBe('test-task');
    expect(task!.status).toBe('running');
  });

  it('should schedule a delayed task', async () => {
    const id = await scheduler.schedule({
      name: 'delayed-task',
      input: {},
      options: { priority: 'normal', delayMs: 5000 },
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    });

    const task = scheduler.getStatus(id);
    expect(task!.status).toBe('pending');
  });

  it('should cancel a task', async () => {
    const id = await scheduler.schedule({
      name: 'cancellable',
      input: {},
      options: { priority: 'normal' },
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    });

    expect(await scheduler.cancel(id)).toBe(true);
    expect(scheduler.getStatus(id)!.status).toBe('cancelled');
  });

  it('should list tasks by organization', async () => {
    await scheduler.schedule({
      name: 't1', input: {}, options: { priority: 'normal' },
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    });
    await scheduler.schedule({
      name: 't2', input: {}, options: { priority: 'normal' },
      context: { organizationId: 'org-2', userId: 'u1', requestId: 'r1' } as any,
    });

    expect(scheduler.listByOrganization('org-1').length).toBe(1);
    expect(scheduler.listByOrganization('org-2').length).toBe(1);
  });

  it('should process next by priority', async () => {
    await scheduler.schedule({
      name: 'low-priority', input: {}, options: { priority: 'low' },
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    });
    await scheduler.schedule({
      name: 'high-priority', input: {}, options: { priority: 'high' },
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    });

    const next = await scheduler.processNext();
    expect(next).toBeDefined();
    expect(next!.name).toBe('high-priority');
  });

  it('should track queue size', async () => {
    await scheduler.schedule({
      name: 't1', input: {}, options: { priority: 'normal' },
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    });
    await scheduler.schedule({
      name: 't2', input: {}, options: { priority: 'normal' },
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    });

    expect(scheduler.getQueueSize()).toBe(2);
    expect(scheduler.getQueueSize('org-1')).toBe(2);
    expect(scheduler.getQueueSize('org-2')).toBe(0);
  });

  it('should mark task completed', async () => {
    const id = await scheduler.schedule({
      name: 'task', input: {}, options: { priority: 'normal' },
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    });

    scheduler.markCompleted(id, { result: 'done' });
    const task = scheduler.getStatus(id);
    expect(task!.status).toBe('completed');
    expect(task!.result).toEqual({ result: 'done' });
  });

  it('should mark task failed and retry', async () => {
    const id = await scheduler.schedule({
      name: 'retry-task', input: {}, options: { priority: 'normal', retryCount: 1, retryDelayMs: 10 },
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    });

    scheduler.markFailed(id, 'temporary error');
    const task = scheduler.getStatus(id);
    expect(task!.retryAttempts).toBe(1);
    expect(task!.status).toBe('pending');
  });

  it('should stop retrying after max attempts', async () => {
    const id = await scheduler.schedule({
      name: 'fail-task', input: {}, options: { priority: 'normal', retryCount: 2, retryDelayMs: 10 },
      context: { organizationId: 'org-1', userId: 'u1', requestId: 'r1' } as any,
    });

    scheduler.markFailed(id, 'error 1');
    scheduler.markFailed(id, 'error 2');
    scheduler.markFailed(id, 'error 3');
    const task = scheduler.getStatus(id);
    expect(task!.status).toBe('failed');
    expect(task!.retryAttempts).toBe(3);
  });
});
