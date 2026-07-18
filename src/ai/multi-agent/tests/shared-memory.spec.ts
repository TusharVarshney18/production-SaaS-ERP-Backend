import { SharedMemoryService } from '../shared-memory/shared-memory.service';

describe('SharedMemoryService', () => {
  let service: SharedMemoryService;

  beforeEach(() => {
    service = new SharedMemoryService();
  });

  it('should set and get memory', async () => {
    await service.set('test-key', { data: 'value' }, {
      organizationId: 'org-1',
      createdBy: 'test',
    });
    const entry = await service.get('org-1', 'test-key');
    expect(entry).toBeDefined();
    expect(entry!.value).toEqual({ data: 'value' });
  });

  it('should return undefined for missing key', async () => {
    const entry = await service.get('org-1', 'nonexistent');
    expect(entry).toBeUndefined();
  });

  it('should scope by organization', async () => {
    await service.set('key', 'org1-value', { organizationId: 'org-1', createdBy: 'test' });
    await service.set('key', 'org2-value', { organizationId: 'org-2', createdBy: 'test' });
    const entry = await service.get('org-1', 'key');
    expect(entry!.value).toBe('org1-value');
  });

  it('should query by tags', async () => {
    await service.set('k1', 'v1', { organizationId: 'org-1', tags: ['important'], createdBy: 'test' });
    await service.set('k2', 'v2', { organizationId: 'org-1', tags: ['normal'], createdBy: 'test' });
    const results = await service.query({ organizationId: 'org-1', tags: ['important'] });
    expect(results.length).toBe(1);
    expect(results[0].key).toBe('k1');
  });

  it('should delete memory', async () => {
    await service.set('key', 'value', { organizationId: 'org-1', createdBy: 'test' });
    expect(await service.delete('org-1', 'key')).toBe(true);
    expect(await service.get('org-1', 'key')).toBeUndefined();
  });

  it('should clear workflow memory', async () => {
    await service.set('k1', 'v1', { organizationId: 'org-1', workflowId: 'wf-1', createdBy: 'test' });
    await service.set('k2', 'v2', { organizationId: 'org-1', workflowId: 'wf-1', createdBy: 'test' });
    await service.set('k3', 'v3', { organizationId: 'org-1', workflowId: 'wf-2', createdBy: 'test' });
    expect(await service.clearWorkflowMemory('org-1', 'wf-1')).toBe(2);
  });

  it('should clear organization memory', async () => {
    await service.set('k1', 'v1', { organizationId: 'org-1', createdBy: 'test' });
    await service.set('k2', 'v2', { organizationId: 'org-1', createdBy: 'test' });
    expect(await service.clearOrganizationMemory('org-1')).toBe(2);
  });
});
