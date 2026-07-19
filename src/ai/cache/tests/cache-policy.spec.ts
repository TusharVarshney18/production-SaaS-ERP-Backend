import { CachePolicyManager } from '../services/cache-policy-manager.service';

describe('CachePolicyManager', () => {
  let policyManager: CachePolicyManager;

  beforeEach(() => {
    policyManager = new CachePolicyManager();
  });

  it('should return default policy for unknown category', () => {
    const policy = policyManager.getPolicy('unknown');
    expect(policy.maxSize).toBe(1000);
    expect(policy.evictionStrategy).toBe('lru');
    expect(policy.defaultTtlMs).toBe(300_000);
  });

  it('should return category-specific policy', () => {
    const policy = policyManager.getPolicy('llm.response');
    expect(policy.maxSize).toBe(500);
    expect(policy.defaultTtlMs).toBe(300_000);
  });

  it('should set custom policy', () => {
    policyManager.setPolicy('test-category', { maxSize: 200, evictionStrategy: 'fifo' });
    const policy = policyManager.getPolicy('test-category');
    expect(policy.maxSize).toBe(200);
    expect(policy.evictionStrategy).toBe('fifo');
  });

  it('should detect eviction needed', () => {
    policyManager.setPolicy('test', { maxSize: 10 });
    expect(policyManager.shouldEvict('test', 10)).toBe(true);
    expect(policyManager.shouldEvict('test', 5)).toBe(false);
  });

  it('should select LRU eviction candidates', () => {
    const entries = [
      { key: 'old', metadata: { accessedAt: 100, accessCount: 1, createdAt: 50 } },
      { key: 'new', metadata: { accessedAt: 200, accessCount: 5, createdAt: 100 } },
      { key: 'middle', metadata: { accessedAt: 150, accessCount: 3, createdAt: 75 } },
    ];

    const candidates = policyManager.selectEvictionCandidates('test', entries, 1);
    expect(candidates.length).toBe(1);
    expect(candidates[0]).toBe('old');
  });

  it('should select LFU eviction candidates', () => {
    policyManager.setPolicy('test', { evictionStrategy: 'lfu' });
    const entries = [
      { key: 'popular', metadata: { accessedAt: 200, accessCount: 100, createdAt: 100 } },
      { key: 'unpopular', metadata: { accessedAt: 150, accessCount: 1, createdAt: 50 } },
    ];

    const candidates = policyManager.selectEvictionCandidates('test', entries, 1);
    expect(candidates[0]).toBe('unpopular');
  });

  it('should select FIFO eviction candidates', () => {
    policyManager.setPolicy('test', { evictionStrategy: 'fifo' });
    const entries = [
      { key: 'first', metadata: { accessedAt: 300, accessCount: 10, createdAt: 50 } },
      { key: 'last', metadata: { accessedAt: 100, accessCount: 1, createdAt: 200 } },
    ];

    const candidates = policyManager.selectEvictionCandidates('test', entries, 1);
    expect(candidates[0]).toBe('first');
  });
});
