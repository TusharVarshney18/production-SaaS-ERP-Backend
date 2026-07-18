import { ProgressTracker } from '../jobs/progress-tracker.service';

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    tracker = new ProgressTracker();
  });

  it('should track progress percentage', async () => {
    await tracker.track('job-1', 50, 'Halfway');
    const progress = await tracker.getProgress('job-1');
    expect(progress).toBeDefined();
    expect(progress!.percentage).toBe(50);
    expect(progress!.logs.length).toBe(1);
  });

  it('should mark started', async () => {
    await tracker.markStarted('job-1');
    const progress = await tracker.getProgress('job-1');
    expect(progress!.status).toBe('processing');
    expect(progress!.startedAt).toBeDefined();
  });

  it('should mark completed', async () => {
    await tracker.markCompleted('job-1', { result: 'ok' });
    const progress = await tracker.getProgress('job-1');
    expect(progress!.status).toBe('completed');
    expect(progress!.percentage).toBe(100);
  });

  it('should mark failed', async () => {
    await tracker.markFailed('job-1', 'something broke');
    const progress = await tracker.getProgress('job-1');
    expect(progress!.status).toBe('failed');
  });

  it('should mark cancelled', async () => {
    await tracker.markCancelled('job-1');
    const progress = await tracker.getProgress('job-1');
    expect(progress!.status).toBe('cancelled');
  });

  it('should add log entries', async () => {
    await tracker.log('job-1', 'Step 1 done');
    await tracker.log('job-1', 'Step 2 done');
    const progress = await tracker.getProgress('job-1');
    expect(progress!.logs.length).toBe(2);
  });

  it('should clamp progress to 0-100', async () => {
    await tracker.track('job-1', -10);
    let progress = await tracker.getProgress('job-1');
    expect(progress!.percentage).toBe(0);

    await tracker.track('job-1', 150);
    progress = await tracker.getProgress('job-1');
    expect(progress!.percentage).toBe(100);
  });
});
