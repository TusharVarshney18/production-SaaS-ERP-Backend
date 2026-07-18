import { Test, TestingModule } from '@nestjs/testing';
import { ConversationHistoryService } from '../services/conversation-history.service';
import { ConversationRepository } from '../repositories/conversation.repository';
import {
  InMemoryConversationProvider,
  InMemoryMessageProvider,
  InMemorySummaryProvider,
} from '../providers/in-memory.provider';
import { ConversationMessage } from '../interfaces/conversation.interface';

describe('ConversationHistoryService', () => {
  let service: ConversationHistoryService;
  let repo: ConversationRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationHistoryService,
        ConversationRepository,
        InMemoryConversationProvider,
        InMemoryMessageProvider,
        InMemorySummaryProvider,
      ],
    }).compile();

    service = module.get<ConversationHistoryService>(ConversationHistoryService);
    repo = module.get<ConversationRepository>(ConversationRepository);
  });

  const addMsg = async (msg: Partial<ConversationMessage>) => {
    const base: ConversationMessage = {
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      content: '',
      tokenCount: 1,
      createdAt: 'now',
    };
    await repo.addMessage({ ...base, ...msg });
  };

  it('should get full history', async () => {
    await addMsg({ id: 'm1', role: 'user', content: 'Hello' });
    await addMsg({ id: 'm2', role: 'assistant', content: 'Hi' });
    const history = await service.getHistory({ conversationId: 'c1' });
    expect(history.length).toBe(2);
  });

  it('should filter out tool calls', async () => {
    await addMsg({ id: 'm1', role: 'user', content: 'Hello' });
    await addMsg({ id: 'm2', role: 'tool', content: '{"result":"ok"}', toolName: 'test-tool' });
    const filtered = await service.getHistory({ conversationId: 'c1', includeToolCalls: false });
    expect(filtered.length).toBe(1);
  });

  it('should filter out system messages', async () => {
    await addMsg({ id: 'm1', role: 'system', content: 'System prompt' });
    await addMsg({ id: 'm2', role: 'user', content: 'Hello' });
    const filtered = await service.getHistory({
      conversationId: 'c1',
      includeSystemMessages: false,
    });
    expect(filtered.length).toBe(1);
  });

  it('should get message count', async () => {
    await addMsg({ id: 'm1', role: 'user', content: 'A' });
    await addMsg({ id: 'm2', role: 'assistant', content: 'B' });
    expect(await service.getMessageCount('c1')).toBe(2);
  });

  it('should get total tokens', async () => {
    await addMsg({ id: 'm1', role: 'user', content: 'A', tokenCount: 10 });
    await addMsg({ id: 'm2', role: 'assistant', content: 'B', tokenCount: 20 });
    expect(await service.getTotalTokens('c1')).toBe(30);
  });

  it('should get tool execution history', async () => {
    await addMsg({ id: 'm1', role: 'user', content: 'do it' });
    await addMsg({ id: 'm2', role: 'tool', content: 'done', toolName: 'test-tool' });
    const tools = await service.getToolExecutionHistory('c1');
    expect(tools.length).toBe(1);
    expect(tools[0].toolName).toBe('test-tool');
  });

  it('should get agent selection history', async () => {
    await addMsg({ id: 'm1', role: 'user', content: 'Hi' });
    await addMsg({ id: 'm2', role: 'assistant', content: 'Hello', agentName: 'ceo' });
    await addMsg({ id: 'm3', role: 'assistant', content: 'World', agentName: 'ceo' });
    const agents = await service.getAgentSelectionHistory('c1');
    expect(agents.length).toBe(1);
    expect(agents[0].count).toBe(2);
  });

  it('should get error history', async () => {
    await addMsg({ id: 'm1', role: 'user', content: 'do it' });
    await addMsg({ id: 'm2', role: 'assistant', content: 'error', metadata: { error: 'timeout' } });
    const errors = await service.getErrorHistory('c1');
    expect(errors.length).toBe(1);
  });

  it('should save and retrieve summary', async () => {
    const summary = await service.saveSummary('c1', 'Conversation summary', ['point1', 'point2']);
    expect(summary.conversationId).toBe('c1');
    expect(summary.keyPoints).toContain('point1');

    const found = await service.getSummary('c1');
    expect(found).toBeDefined();
    expect(found?.summary).toBe('Conversation summary');
  });
});
