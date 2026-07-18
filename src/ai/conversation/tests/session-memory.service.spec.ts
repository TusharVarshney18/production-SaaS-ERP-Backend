import { Test, TestingModule } from '@nestjs/testing';
import { SessionMemoryService } from '../services/session-memory.service';
import { ConversationMessage } from '../interfaces/conversation.interface';

describe('SessionMemoryService', () => {
  let service: SessionMemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionMemoryService],
    }).compile();
    service = module.get<SessionMemoryService>(SessionMemoryService);
  });

  it('should create a session', () => {
    const session = service.createSession('conv-1', 'org-1', 'user-1');
    expect(session.conversationId).toBe('conv-1');
    expect(session.organizationId).toBe('org-1');
    expect(session.userId).toBe('user-1');
    expect(session.lastMessages).toEqual([]);
  });

  it('should get a session', () => {
    service.createSession('conv-1', 'org-1', 'user-1');
    const session = service.getSession('org-1', 'user-1');
    expect(session).toBeDefined();
    expect(session?.conversationId).toBe('conv-1');
  });

  it('should return undefined for missing session', () => {
    expect(service.getSession('org-x', 'user-x')).toBeUndefined();
  });

  it('should push messages to session', () => {
    service.createSession('conv-1', 'org-1', 'user-1');
    const msg: ConversationMessage = {
      id: 'm1',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Hi',
      tokenCount: 1,
      createdAt: 'now',
    };
    service.pushMessage('org-1', 'user-1', msg);
    const messages = service.getLastMessages('org-1', 'user-1');
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('Hi');
  });

  it('should limit last messages to 50', () => {
    service.createSession('conv-1', 'org-1', 'user-1');
    for (let i = 0; i < 55; i++) {
      service.pushMessage('org-1', 'user-1', {
        id: `m${i}`,
        conversationId: 'conv-1',
        role: 'user',
        content: `msg${i}`,
        tokenCount: 1,
        createdAt: 'now',
      });
    }
    expect(service.getLastMessages('org-1', 'user-1').length).toBe(50);
  });

  it('should set and get temporary variables', () => {
    service.createSession('conv-1', 'org-1', 'user-1');
    service.setTemporaryVariable('org-1', 'user-1', 'key1', { data: 'test' });
    expect(service.getTemporaryVariable('org-1', 'user-1', 'key1')).toEqual({ data: 'test' });
  });

  it('should clear temporary variables', () => {
    service.createSession('conv-1', 'org-1', 'user-1');
    service.setTemporaryVariable('org-1', 'user-1', 'key1', 'value1');
    service.clearTemporaryVariables('org-1', 'user-1');
    expect(service.getTemporaryVariable('org-1', 'user-1', 'key1')).toBeUndefined();
  });

  it('should set current agent', () => {
    service.createSession('conv-1', 'org-1', 'user-1');
    service.setCurrentAgent('org-1', 'user-1', 'ceo-agent');
    expect(service.getSession('org-1', 'user-1')?.currentAgentName).toBe('ceo-agent');
  });

  it('should set current plan', () => {
    service.createSession('conv-1', 'org-1', 'user-1');
    service.setCurrentPlan('org-1', 'user-1', 'plan-1');
    expect(service.getSession('org-1', 'user-1')?.currentPlanId).toBe('plan-1');
  });

  it('should end a session', () => {
    service.createSession('conv-1', 'org-1', 'user-1');
    expect(service.endSession('org-1', 'user-1')).toBe(true);
    expect(service.getSession('org-1', 'user-1')).toBeUndefined();
  });

  it('should end session by conversation', () => {
    service.createSession('conv-1', 'org-1', 'user-1');
    expect(service.endSessionByConversation('conv-1')).toBe(true);
  });

  it('should count active sessions', () => {
    service.createSession('conv-1', 'org-1', 'user-1');
    service.createSession('conv-2', 'org-1', 'user-2');
    expect(service.getActiveSessionCount()).toBe(2);
  });

  it('should update last activity', async () => {
    service.createSession('conv-1', 'org-1', 'user-1');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const before = service.getSession('org-1', 'user-1')!.lastActivityAt;
    service.updateLastActivity('org-1', 'user-1');
    const after = service.getSession('org-1', 'user-1')!.lastActivityAt;
    expect(after).not.toBe(before);
  });

  it('should get session by conversation ID', () => {
    service.createSession('conv-1', 'org-1', 'user-1');
    const session = service.getSessionByConversation('conv-1');
    expect(session).toBeDefined();
    expect(session?.organizationId).toBe('org-1');
  });
});
