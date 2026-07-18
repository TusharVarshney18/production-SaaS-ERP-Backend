import { Test, TestingModule } from '@nestjs/testing';
import { LongTermMemoryService } from '../services/long-term-memory.service';
import { MemoryRepository } from '../repositories/memory.repository';
import { InMemoryMemoryStorageProvider } from '../providers/in-memory.provider';
import { MEMORY_STORAGE_PROVIDER_TOKEN } from '../providers/tokens';

describe('LongTermMemoryService', () => {
  let service: LongTermMemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LongTermMemoryService,
        MemoryRepository,
        InMemoryMemoryStorageProvider,
        {
          provide: MEMORY_STORAGE_PROVIDER_TOKEN,
          useExisting: InMemoryMemoryStorageProvider,
        },
      ],
    }).compile();

    service = module.get<LongTermMemoryService>(LongTermMemoryService);
  });

  it('should save and get a memory', async () => {
    const saved = await service.saveMemory({
      organizationId: 'org-1',
      type: 'preferences',
      key: 'language',
      value: 'en',
      scope: 'user',
      userId: 'user-1',
    });
    expect(saved.id).toBeDefined();
    expect(saved.key).toBe('language');

    const found = await service.getMemory('org-1', 'language', 'user-1');
    expect(found).toBeDefined();
    expect(found?.value).toBe('en');
  });

  it('should find user memories', async () => {
    await service.saveMemory({
      organizationId: 'org-1',
      userId: 'user-1',
      type: 'preferences',
      key: 'theme',
      value: 'dark',
      scope: 'user',
    });
    await service.saveMemory({
      organizationId: 'org-1',
      userId: 'user-1',
      type: 'user',
      key: 'name',
      value: 'Alice',
      scope: 'user',
    });
    const memories = await service.findUserMemories('org-1', 'user-1');
    expect(memories.length).toBe(2);
  });

  it('should find memories by type', async () => {
    await service.saveMemory({
      organizationId: 'org-1',
      type: 'preferences',
      key: 'lang',
      value: 'en',
      scope: 'organization',
    });
    await service.saveMemory({
      organizationId: 'org-1',
      type: 'ai',
      key: 'model',
      value: 'gpt-4',
      scope: 'organization',
    });
    const prefs = await service.findOrganizationMemories('org-1', 'preferences');
    expect(prefs.length).toBe(1);
  });

  it('should find memories by tags', async () => {
    await service.saveMemory({
      organizationId: 'org-1',
      type: 'preferences',
      key: 'lang',
      value: 'en',
      scope: 'organization',
      tags: ['important'],
    });
    const found = await service.findMemoriesByTags('org-1', ['important']);
    expect(found.length).toBe(1);
  });

  it('should update memory', async () => {
    const saved = await service.saveMemory({
      organizationId: 'org-1',
      type: 'preferences',
      key: 'lang',
      value: 'en',
      scope: 'organization',
    });
    const updated = await service.updateMemory(saved.id, 'fr');
    expect(updated?.value).toBe('fr');
  });

  it('should delete memory', async () => {
    const saved = await service.saveMemory({
      organizationId: 'org-1',
      type: 'preferences',
      key: 'lang',
      value: 'en',
      scope: 'organization',
    });
    expect(await service.deleteMemory(saved.id)).toBe(true);
    expect(await service.getMemory('org-1', 'lang')).toBeNull();
  });

  it('should clear user memories', async () => {
    await service.saveMemory({
      organizationId: 'org-1',
      userId: 'user-1',
      type: 'preferences',
      key: 'k1',
      value: 'v1',
      scope: 'user',
    });
    await service.saveMemory({
      organizationId: 'org-1',
      userId: 'user-2',
      type: 'preferences',
      key: 'k2',
      value: 'v2',
      scope: 'user',
    });
    expect(await service.clearUserMemories('org-1', 'user-1')).toBe(1);
  });

  it('should clear organization memories', async () => {
    await service.saveMemory({
      organizationId: 'org-1',
      type: 'preferences',
      key: 'k1',
      value: 'v1',
      scope: 'organization',
    });
    await service.saveMemory({
      organizationId: 'org-1',
      type: 'preferences',
      key: 'k2',
      value: 'v2',
      scope: 'organization',
    });
    expect(await service.clearOrganizationMemories('org-1')).toBe(2);
  });

  it('should get relevant memories grouped', async () => {
    await service.saveMemory({
      organizationId: 'org-1',
      type: 'preferences',
      key: 'org_lang',
      value: 'en',
      scope: 'organization',
    });
    await service.saveMemory({
      organizationId: 'org-1',
      userId: 'user-1',
      type: 'preferences',
      key: 'user_theme',
      value: 'dark',
      scope: 'user',
    });
    const grouped = await service.getRelevantMemories('org-1', 'user-1');
    expect(grouped.organization.length).toBe(1);
    expect(grouped.user.length).toBe(1);
  });

  it('should enforce org isolation', async () => {
    await service.saveMemory({
      organizationId: 'org-1',
      type: 'preferences',
      key: 'secret',
      value: 'org1-data',
      scope: 'organization',
    });
    const found = await service.getMemory('org-2', 'secret');
    expect(found).toBeNull();
  });
});
