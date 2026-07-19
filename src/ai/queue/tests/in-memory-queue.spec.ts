import { InMemoryQueueProvider } from '../providers/in-memory-queue.provider';
import { JobDefinition } from '../dto/job.dto';

describe('InMemoryQueueProvider', () => {
  let provider: InMemoryQueueProvider;

  beforeEach(() => {
    provider = new InMemoryQueueProvider();
  });

  const createJob = (overrides: Partial<JobDefinition> = {}): JobDefinition => ({
    id: `job-${Date.now()}`,
    type: 'custom',
    payload: {},
    options: { priority: 'normal' },
    organizationId: 'org-1',
    userId: 'u1',
    status: 'queued',
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it('should enqueue a job', async () => {
    const job = createJob();
    const id = await provider.enqueue(job);
    expect(id).toBe(job.id);
  });

  it('should dequeue a job', async () => {
    const job = createJob();
    await provider.enqueue(job);

    const dequeued = await provider.dequeue('worker-1');
    expect(dequeued).not.toBeNull();
    expect(dequeued!.job.id).toBe(job.id);
    expect(dequeued!.status).toBe('processing');
  });

  it('should respect priority order', async () => {
    const lowJob = createJob({ id: 'low', options: { priority: 'low' } });
    const highJob = createJob({ id: 'high', options: { priority: 'high' } });

    await provider.enqueue(lowJob, { priority: 'low' });
    await provider.enqueue(highJob, { priority: 'high' });

    const first = await provider.dequeue('worker-1');
    expect(first!.job.id).toBe('high');
  });

  it('should acknowledge a job', async () => {
    const job = createJob();
    await provider.enqueue(job);
    await provider.dequeue('worker-1');

    expect(await provider.acknowledge(job.id, 'worker-1')).toBe(true);
  });

  it('should fail a job', async () => {
    const job = createJob();
    await provider.enqueue(job);
    await provider.dequeue('worker-1');

    expect(await provider.fail(job.id, 'worker-1', 'error')).toBe(true);
  });

  it('should schedule a delayed job', async () => {
    const job = createJob();
    const future = new Date(Date.now() + 60000).toISOString();
    const id = await provider.schedule(job, future);
    expect(id).toBe(job.id);
  });

  it('should remove a job', async () => {
    const job = createJob();
    await provider.enqueue(job);
    expect(await provider.remove(job.id)).toBe(true);
  });

  it('should pause and resume', async () => {
    await provider.pause();
    expect(provider.isPaused()).toBe(true);

    const job = createJob();
    await expect(provider.enqueue(job)).rejects.toThrow('Queue is paused');

    await provider.resume();
    expect(provider.isPaused()).toBe(false);
    const id = await provider.enqueue(job);
    expect(id).toBeDefined();
  });

  it('should return stats', async () => {
    const stats = await provider.getStats();
    expect(stats.totalJobs).toBe(0);

    const job = createJob();
    await provider.enqueue(job);

    const updatedStats = await provider.getStats();
    expect(updatedStats.waitingJobs).toBe(1);
  });
});
