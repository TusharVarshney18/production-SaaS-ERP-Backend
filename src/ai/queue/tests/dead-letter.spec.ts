import { DeadLetterManager } from '../dead-letter/dead-letter.manager';
import { JobDefinition } from '../dto/job.dto';

describe('DeadLetterManager', () => {
  let dlq: DeadLetterManager;

  beforeEach(() => {
    dlq = new DeadLetterManager();
  });

  const createJob = (): JobDefinition => ({
    id: 'job-1',
    type: 'custom',
    payload: { data: 'test' },
    options: { priority: 'normal' },
    organizationId: 'org-1',
    userId: 'u1',
    status: 'failed',
    attempts: 3,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: 'test error',
  });

  it('should move job to DLQ', async () => {
    const id = await dlq.moveToDlq(createJob(), 'Max retries', 'test error');
    expect(id).toBeDefined();
    expect(await dlq.getCount()).toBe(1);
  });

  it('should list DLQ entries', async () => {
    await dlq.moveToDlq(createJob(), 'Reason 1', 'Error 1');
    await dlq.moveToDlq(
      { ...createJob(), id: 'job-2', type: 'rag.indexing' as any },
      'Reason 2',
      'Error 2',
    );

    const all = await dlq.list();
    expect(all.length).toBe(2);

    const filtered = await dlq.list('rag.indexing');
    expect(filtered.length).toBe(1);
  });

  it('should retry a DLQ entry', async () => {
    const dlqId = await dlq.moveToDlq(createJob(), 'Retry test', 'error');
    const jobId = await dlq.retry(dlqId);
    expect(jobId).toBeDefined();
    expect(jobId).not.toBe('job-1');
    expect(await dlq.getCount()).toBe(0);
  });

  it('should purge all entries', async () => {
    await dlq.moveToDlq(createJob(), 'R1', 'E1');
    await dlq.moveToDlq(createJob(), 'R2', 'E2');
    expect(await dlq.purge()).toBe(2);
    expect(await dlq.getCount()).toBe(0);
  });

  it('should get a specific entry', async () => {
    const dlqId = await dlq.moveToDlq(createJob(), 'Get test', 'error');
    const entry = await dlq.get(dlqId);
    expect(entry).toBeDefined();
    expect(entry!.reason).toBe('Get test');
  });
});
