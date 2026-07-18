import { RetryManager } from '../retry/retry.manager';

describe('RetryManager', () => {
  let retry: RetryManager;

  beforeEach(() => {
    retry = new RetryManager();
  });

  it('should allow retry within limits', async () => {
    const should = await retry.shouldRetry('job-1', 2, 'error');
    expect(should).toBe(true);
  });

  it('should get exponential delay', async () => {
    const delay1 = await retry.getDelay('job-1', 1);
    const delay2 = await retry.getDelay('job-1', 2);
    const delay3 = await retry.getDelay('job-1', 3);

    expect(delay2).toBeGreaterThanOrEqual(delay1);
    expect(delay3).toBeGreaterThanOrEqual(delay2);
  });

  it('should record attempts', async () => {
    await retry.recordAttempt('job-1', 1, 'err');
    await retry.recordAttempt('job-1', 2, 'err');

    const should = await retry.shouldRetry('job-1', 3, 'err');
    expect(should).toBe(true);
  });

  it('should get retry policy by job type', () => {
    const policy = retry.getRetryPolicy('rag.indexing');
    expect(policy.maxRetries).toBe(3);
    expect(policy.strategy).toBe('exponential');
  });

  it('should set custom retry policy', () => {
    retry.setRetryPolicy('custom-type', {
      strategy: 'fixed',
      maxRetries: 5,
      initialDelayMs: 500,
      maxDelayMs: 500,
      backoffMultiplier: 1,
      retryOnTimeout: true,
      retryOnError: true,
    });

    const policy = retry.getRetryPolicy('custom-type');
    expect(policy.maxRetries).toBe(5);
    expect(policy.initialDelayMs).toBe(500);
  });
});
