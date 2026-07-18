import { Test, TestingModule } from '@nestjs/testing';
import { ConversationManagerService } from '../services/conversation-manager.service';
import { ConversationRepository } from '../repositories/conversation.repository';
import { SessionMemoryService } from '../services/session-memory.service';
import {
  InMemoryConversationProvider,
  InMemoryMessageProvider,
  InMemorySummaryProvider,
} from '../providers/in-memory.provider';

describe('ConversationManagerService', () => {
  let service: ConversationManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationManagerService,
        ConversationRepository,
        SessionMemoryService,
        InMemoryConversationProvider,
        InMemoryMessageProvider,
        InMemorySummaryProvider,
      ],
    }).compile();

    service = module.get<ConversationManagerService>(ConversationManagerService);
  });

  it('should start a conversation', async () => {
    const conv = await service.startConversation({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Test conversation',
    });
    expect(conv.id).toBeDefined();
    expect(conv.organizationId).toBe('org-1');
    expect(conv.userId).toBe('user-1');
    expect(conv.status).toBe('active');
    expect(conv.messageCount).toBe(0);
  });

  it('should start a conversation with agent name', async () => {
    const conv = await service.startConversation({
      organizationId: 'org-1',
      userId: 'user-1',
      agentName: 'ceo',
    });
    expect(conv.agentName).toBe('ceo');
  });

  it('should add a user message', async () => {
    const conv = await service.startConversation({
      organizationId: 'org-1',
      userId: 'user-1',
    });
    const msg = await service.addMessage({
      conversationId: conv.id,
      role: 'user',
      content: 'Hello',
    });
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
    expect(msg.tokenCount).toBeGreaterThan(0);
  });

  it('should add an assistant message', async () => {
    const conv = await service.startConversation({
      organizationId: 'org-1',
      userId: 'user-1',
    });
    const msg = await service.addMessage({
      conversationId: conv.id,
      role: 'assistant',
      content: 'Hi there!',
      agentName: 'ceo',
    });
    expect(msg.role).toBe('assistant');
    expect(msg.agentName).toBe('ceo');
  });

  it('should throw when adding message to ended conversation', async () => {
    const conv = await service.startConversation({
      organizationId: 'org-1',
      userId: 'user-1',
    });
    await service.endConversation(conv.id);
    await expect(
      service.addMessage({ conversationId: conv.id, role: 'user', content: 'test' }),
    ).rejects.toThrow('has ended');
  });

  it('should throw when adding message to nonexistent conversation', async () => {
    await expect(
      service.addMessage({ conversationId: 'nonexistent', role: 'user', content: 'test' }),
    ).rejects.toThrow('not found');
  });

  it('should end a conversation', async () => {
    const conv = await service.startConversation({
      organizationId: 'org-1',
      userId: 'user-1',
    });
    const ended = await service.endConversation(conv.id);
    expect(ended.status).toBe('ended');
    expect(ended.endedAt).toBeDefined();
  });

  it('should update message count and tokens on add', async () => {
    const conv = await service.startConversation({
      organizationId: 'org-1',
      userId: 'user-1',
    });
    await service.addMessage({ conversationId: conv.id, role: 'user', content: 'Hello world' });
    await service.addMessage({ conversationId: conv.id, role: 'assistant', content: 'Hi there' });
    const updated = await service.getConversation(conv.id);
    expect(updated?.messageCount).toBe(2);
    expect(updated?.totalTokens).toBeGreaterThan(0);
  });

  it('should get messages for a conversation', async () => {
    const conv = await service.startConversation({
      organizationId: 'org-1',
      userId: 'user-1',
    });
    await service.addMessage({ conversationId: conv.id, role: 'user', content: 'Hello' });
    const messages = await service.getMessages(conv.id);
    expect(messages.length).toBe(1);
  });

  it('should list conversations for an organization', async () => {
    await service.startConversation({ organizationId: 'org-1', userId: 'user-1' });
    const list = await service.listConversations('org-1');
    expect(list.length).toBe(1);
  });

  it('should delete a conversation', async () => {
    const conv = await service.startConversation({
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(await service.deleteConversation(conv.id)).toBe(true);
    expect(await service.getConversation(conv.id)).toBeNull();
  });
});
