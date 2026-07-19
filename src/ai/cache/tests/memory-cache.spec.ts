import { MemoryCacheProvider } from '../providers/memory-cache.provider';

describe('MemoryCacheProvider', () => {
  let provider: MemoryCacheProvider;

  beforeEach(() => {
    provider = new MemoryCacheProvider();
  });

  it('should set and get a value', async () => {
    await provider.set('key1', { data: 'test' }, 'org-1', 'llm.response');
    const result = await provider.get('key1', 'org-1');
    expect(result).not.toBeNull();
    expect(result!.value).toEqual({ data: 'test' });
  });

  it('should return null for missing key', async () => {
    const result = await provider.get('nonexistent', 'org-1');
    expect(result).toBeNull();
  });

  it('should enforce organization isolation', async () => {
    await provider.set('key1', 'org1-value', 'org-1', 'llm.response');
    const result = await provider.get('key1', 'org-2');
    expect(result).toBeNull();
  });

  it('should delete a value', async () => {
    await provider.set('key1', 'value', 'org-1', 'llm.response');
    expect(await provider.delete('key1', 'org-1')).toBe(true);
    expect(await provider.get('key1', 'org-1')).toBeNull();
  });

  it('should delete by category', async () => {
    await provider.set('k1', 'v1', 'org-1', 'llm.response');
    await provider.set('k2', 'v2', 'org-1', 'rag.retrieval');
    expect(await provider.deleteByCategory('llm.response', 'org-1')).toBe(1);
    expect(await provider.exists('k1', 'org-1')).toBe(false);
    expect(await provider.exists('k2', 'org-1')).toBe(true);
  });

  it('should delete by organization', async () => {
    await provider.set('k1', 'v1', 'org-1', 'llm.response');
    await provider.set('k2', 'v2', 'org-2', 'llm.response');
    expect(await provider.deleteByOrganization('org-1')).toBe(1);
    expect(await provider.getSize()).toBe(1);
  });

  it('should check existence', async () => {
    await provider.set('key1', 'value', 'org-1', 'llm.response');
    expect(await provider.exists('key1', 'org-1')).toBe(true);
    expect(await provider.exists('nonexistent', 'org-1')).toBe(false);
  });

  it('should clear all data', async () => {
    await provider.set('k1', 'v1', 'org-1', 'llm.response');
    await provider.set('k2', 'v2', 'org-1', 'rag.retrieval');
    await provider.clear();
    expect(await provider.getSize()).toBe(0);
  });

  it('should respect TTL expiry', async () => {
    await provider.set('key1', 'value', 'org-1', 'llm.response', { ttl: -1 });
    const result = await provider.get('key1', 'org-1');
    expect(result).toBeNull();
  });

  it('should get keys by organization', async () => {
    await provider.set('k1', 'v1', 'org-1', 'llm.response');
    await provider.set('k2', 'v2', 'org-1', 'rag.retrieval');
    await provider.set('k3', 'v3', 'org-2', 'llm.response');
    const org1Keys = await provider.getKeys('org-1');
    expect(org1Keys.length).toBe(2);
  });

  it('should delete by tags', async () => {
    await provider.set('k1', 'v1', 'org-1', 'llm.response', { tags: ['important'] });
    await provider.set('k2', 'v2', 'org-1', 'llm.response', { tags: ['normal'] });
    expect(await provider.deleteByTags(['important'], 'org-1')).toBe(1);
    expect(await provider.exists('k1', 'org-1')).toBe(false);
    expect(await provider.exists('k2', 'org-1')).toBe(true);
  });

  it('should provide all entries for a category', async () => {
    await provider.set('k1', 'v1', 'org-1', 'llm.response');
    await provider.set('k2', 'v2', 'org-1', 'llm.response');
    await provider.set('k3', 'v3', 'org-1', 'rag.retrieval');
    const entries = provider.getAllEntries('org-1', 'llm.response');
    expect(entries.length).toBe(2);
  });
});
