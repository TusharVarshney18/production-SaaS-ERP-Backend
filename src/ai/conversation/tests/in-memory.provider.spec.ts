import { Test, TestingModule } from '@nestjs/testing';
import {
  InMemoryConversationProvider,
  InMemoryMessageProvider,
  InMemoryMemoryStorageProvider,
} from '../providers/in-memory.provider';
import {
  Conversation,
  ConversationMessage,
  MemoryEntry,
} from '../interfaces/conversation.interface';

describe('InMemoryConversationProvider', () => {
  let provider: InMemoryConversationProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InMemoryConversationProvider],
    }).compile();
    provider = module.get<InMemoryConversationProvider>(InMemoryConversationProvider);
  });

  it('should create and retrieve a conversation', async () => {
    const conv: Conversation = {
      id: 'c1',
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Test',
      status: 'active',
      messageCount: 0,
      totalTokens: 0,
      createdAt: 'now',
      updatedAt: 'now',
    };
    await provider.createConversation(conv);
    const found = await provider.getConversation('c1');
    expect(found).toBeDefined();
    expect(found?.title).toBe('Test');
  });

  it('should return null for missing conversation', async () => {
    expect(await provider.getConversation('nonexistent')).toBeNull();
  });

  it('should update a conversation', async () => {
    const conv: Conversation = {
      id: 'c1',
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Test',
      status: 'active',
      messageCount: 0,
      totalTokens: 0,
      createdAt: 'now',
      updatedAt: 'now',
    };
    await provider.createConversation(conv);
    const updated = await provider.updateConversation('c1', { title: 'Updated' });
    expect(updated?.title).toBe('Updated');
  });

  it('should return null when updating missing conversation', async () => {
    expect(await provider.updateConversation('nonexistent', {})).toBeNull();
  });

  it('should delete a conversation', async () => {
    const conv: Conversation = {
      id: 'c1',
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Test',
      status: 'active',
      messageCount: 0,
      totalTokens: 0,
      createdAt: 'now',
      updatedAt: 'now',
    };
    await provider.createConversation(conv);
    expect(await provider.deleteConversation('c1')).toBe(true);
    expect(await provider.getConversation('c1')).toBeNull();
  });

  it('should list conversations by organization', async () => {
    const c1: Conversation = {
      id: 'c1',
      organizationId: 'org-1',
      userId: 'u1',
      title: 'A',
      status: 'active',
      messageCount: 0,
      totalTokens: 0,
      createdAt: 'now',
      updatedAt: 'now',
    };
    const c2: Conversation = {
      id: 'c2',
      organizationId: 'org-1',
      userId: 'u2',
      title: 'B',
      status: 'active',
      messageCount: 0,
      totalTokens: 0,
      createdAt: 'now',
      updatedAt: 'now',
    };
    const c3: Conversation = {
      id: 'c3',
      organizationId: 'org-2',
      userId: 'u1',
      title: 'C',
      status: 'active',
      messageCount: 0,
      totalTokens: 0,
      createdAt: 'now',
      updatedAt: 'now',
    };
    await provider.createConversation(c1);
    await provider.createConversation(c2);
    await provider.createConversation(c3);
    expect((await provider.listConversations('org-1')).length).toBe(2);
    expect((await provider.listConversations('org-1', 'u1')).length).toBe(1);
  });

  it('should count conversations', async () => {
    const conv: Conversation = {
      id: 'c1',
      organizationId: 'org-1',
      userId: 'u1',
      title: 'Test',
      status: 'active',
      messageCount: 0,
      totalTokens: 0,
      createdAt: 'now',
      updatedAt: 'now',
    };
    await provider.createConversation(conv);
    expect(await provider.countConversations('org-1')).toBe(1);
    expect(await provider.countConversations('org-2')).toBe(0);
  });
});

describe('InMemoryMessageProvider', () => {
  let provider: InMemoryMessageProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InMemoryMessageProvider],
    }).compile();
    provider = module.get<InMemoryMessageProvider>(InMemoryMessageProvider);
  });

  it('should add and retrieve messages', async () => {
    const msg: ConversationMessage = {
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      content: 'Hello',
      tokenCount: 2,
      createdAt: 'now',
    };
    await provider.addMessage(msg);
    const msgs = await provider.getMessages('c1');
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toBe('Hello');
  });

  it('should limit messages', async () => {
    for (let i = 0; i < 5; i++) {
      await provider.addMessage({
        id: `m${i}`,
        conversationId: 'c1',
        role: 'user',
        content: `msg${i}`,
        tokenCount: 1,
        createdAt: 'now',
      });
    }
    const msgs = await provider.getMessages('c1', 3);
    expect(msgs.length).toBe(3);
  });

  it('should delete messages', async () => {
    await provider.addMessage({
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      content: 'Hi',
      tokenCount: 1,
      createdAt: 'now',
    });
    expect(await provider.deleteMessages('c1')).toBe(true);
    expect((await provider.getMessages('c1')).length).toBe(0);
  });

  it('should count messages', async () => {
    await provider.addMessage({
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      content: 'Hi',
      tokenCount: 1,
      createdAt: 'now',
    });
    expect(await provider.countMessages('c1')).toBe(1);
  });

  it('should calculate total tokens', async () => {
    await provider.addMessage({
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      content: 'Hello',
      tokenCount: 5,
      createdAt: 'now',
    });
    await provider.addMessage({
      id: 'm2',
      conversationId: 'c1',
      role: 'assistant',
      content: 'World',
      tokenCount: 5,
      createdAt: 'now',
    });
    expect(await provider.getTotalTokens('c1')).toBe(10);
  });
});

describe('InMemoryMemoryStorageProvider', () => {
  let provider: InMemoryMemoryStorageProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InMemoryMemoryStorageProvider],
    }).compile();
    provider = module.get<InMemoryMemoryStorageProvider>(InMemoryMemoryStorageProvider);
  });

  it('should save and retrieve memory', async () => {
    const entry: MemoryEntry = {
      id: 'm1',
      organizationId: 'org-1',
      type: 'preferences',
      key: 'lang',
      value: 'en',
      scope: 'user',
      tags: [],
      createdAt: 'now',
      updatedAt: 'now',
    };
    await provider.saveMemory(entry);
    const found = await provider.getMemory('org-1', 'lang');
    expect(found).toBeDefined();
    expect(found?.value).toBe('en');
  });

  it('should find memories by type', async () => {
    await provider.saveMemory({
      id: 'm1',
      organizationId: 'org-1',
      type: 'preferences',
      key: 'lang',
      value: 'en',
      scope: 'user',
      tags: [],
      createdAt: 'now',
      updatedAt: 'now',
    });
    await provider.saveMemory({
      id: 'm2',
      organizationId: 'org-1',
      type: 'ai',
      key: 'model',
      value: 'gpt-4',
      scope: 'organization',
      tags: [],
      createdAt: 'now',
      updatedAt: 'now',
    });
    const found = await provider.findMemories('org-1', 'preferences');
    expect(found.length).toBe(1);
    expect(found[0].key).toBe('lang');
  });

  it('should update memory', async () => {
    await provider.saveMemory({
      id: 'm1',
      organizationId: 'org-1',
      type: 'preferences',
      key: 'lang',
      value: 'en',
      scope: 'user',
      tags: [],
      createdAt: 'now',
      updatedAt: 'now',
    });
    const updated = await provider.updateMemory('m1', { value: 'fr' });
    expect(updated?.value).toBe('fr');
  });

  it('should delete memory', async () => {
    await provider.saveMemory({
      id: 'm1',
      organizationId: 'org-1',
      type: 'preferences',
      key: 'lang',
      value: 'en',
      scope: 'user',
      tags: [],
      createdAt: 'now',
      updatedAt: 'now',
    });
    expect(await provider.deleteMemory('m1')).toBe(true);
    expect(await provider.getMemory('org-1', 'lang')).toBeNull();
  });

  it('should delete memories by scope', async () => {
    await provider.saveMemory({
      id: 'm1',
      organizationId: 'org-1',
      type: 'preferences',
      key: 'k1',
      value: 'v1',
      scope: 'user',
      userId: 'u1',
      tags: [],
      createdAt: 'now',
      updatedAt: 'now',
    });
    await provider.saveMemory({
      id: 'm2',
      organizationId: 'org-1',
      type: 'preferences',
      key: 'k2',
      value: 'v2',
      scope: 'organization',
      tags: [],
      createdAt: 'now',
      updatedAt: 'now',
    });
    expect(await provider.deleteMemoriesByScope('org-1', 'user', 'u1')).toBe(1);
  });

  it('should respect memory scope isolation', async () => {
    await provider.saveMemory({
      id: 'm1',
      organizationId: 'org-1',
      type: 'user',
      key: 'secret',
      value: 'data',
      scope: 'user',
      userId: 'u1',
      tags: [],
      createdAt: 'now',
      updatedAt: 'now',
    });
    const found = await provider.getMemory('org-1', 'secret', 'u2');
    expect(found).toBeNull();
  });
});
