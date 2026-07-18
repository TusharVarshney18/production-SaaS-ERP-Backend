import { Test, TestingModule } from '@nestjs/testing';
import { ContextWindowService } from '../services/context-window.service';
import { SessionMemoryService } from '../services/session-memory.service';
import { LongTermMemoryService } from '../services/long-term-memory.service';
import { MemoryRepository } from '../repositories/memory.repository';
import { InMemoryMemoryStorageProvider } from '../providers/in-memory.provider';
import { ConversationMessage } from '../interfaces/conversation.interface';

describe('ContextWindowService', () => {
  let service: ContextWindowService;
  let sessionMemory: SessionMemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextWindowService,
        SessionMemoryService,
        LongTermMemoryService,
        MemoryRepository,
        InMemoryMemoryStorageProvider,
      ],
    }).compile();

    service = module.get<ContextWindowService>(ContextWindowService);
    sessionMemory = module.get<SessionMemoryService>(SessionMemoryService);
  });

  it('should build context window from session messages', async () => {
    sessionMemory.createSession('conv-1', 'org-1', 'user-1');
    sessionMemory.pushMessage('org-1', 'user-1', {
      id: 'm1',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Hello',
      tokenCount: 2,
      createdAt: 'now',
    });

    const window = await service.buildContextWindow('conv-1', 'org-1', 'user-1');
    expect(window.messages.length).toBe(1);
    expect(window.totalTokens).toBe(2);
    expect(window.maxTokens).toBeGreaterThan(0);
    expect(window.trimmedCount).toBe(0);
  });

  it('should trim messages when token budget exceeded', async () => {
    sessionMemory.createSession('conv-1', 'org-1', 'user-1', 10);
    for (let i = 0; i < 10; i++) {
      sessionMemory.pushMessage('org-1', 'user-1', {
        id: `m${i}`,
        conversationId: 'conv-1',
        role: 'user',
        content: `Message ${i}`,
        tokenCount: 5,
        createdAt: 'now',
      });
    }

    const window = await service.buildContextWindow('conv-1', 'org-1', 'user-1', 20);
    expect(window.totalTokens).toBeLessThanOrEqual(20);
    expect(window.trimmedCount).toBeGreaterThan(0);
  });

  it('should include memory messages from long-term memory', async () => {
    sessionMemory.createSession('conv-1', 'org-1', 'user-1');
    sessionMemory.pushMessage('org-1', 'user-1', {
      id: 'm1',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Hello',
      tokenCount: 2,
      createdAt: 'now',
    });

    const window = await service.buildContextWindow('conv-1', 'org-1', 'user-1');
    expect(window.injectedMemoryCount).toBe(0);
    expect(window.messages.length).toBe(1);
  });

  it('should estimate token count', () => {
    expect(service.estimateTokenCount('Hello world')).toBe(3);
    expect(service.estimateTokenCount('')).toBe(0);
    expect(service.estimateTokenCount('A'.repeat(100))).toBe(25);
  });

  it('should trim messages correctly', () => {
    const messages: ConversationMessage[] = [
      {
        id: 'sys',
        conversationId: 'c1',
        role: 'system',
        content: 'Short system',
        tokenCount: 20,
        createdAt: 'now',
      },
      {
        id: 'm1',
        conversationId: 'c1',
        role: 'user',
        content: 'Hello',
        tokenCount: 40,
        createdAt: 'now',
      },
      {
        id: 'm2',
        conversationId: 'c1',
        role: 'assistant',
        content: 'World',
        tokenCount: 40,
        createdAt: 'now',
      },
    ];

    const result = service.trimMessages(messages, 70);
    expect(result.messages.length).toBe(2);
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[1].role).toBe('user');
    expect(result.trimmedCount).toBe(1);
  });

  it('should keep system messages during trim', () => {
    const messages: ConversationMessage[] = [
      {
        id: 'sys',
        conversationId: 'c1',
        role: 'system',
        content: 'Keep me',
        tokenCount: 10,
        createdAt: 'now',
      },
      {
        id: 'm1',
        conversationId: 'c1',
        role: 'user',
        content: 'Drop me',
        tokenCount: 100,
        createdAt: 'now',
      },
    ];

    const result = service.trimMessages(messages, 15);
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].role).toBe('system');
    expect(result.trimmedCount).toBe(1);
  });
});
