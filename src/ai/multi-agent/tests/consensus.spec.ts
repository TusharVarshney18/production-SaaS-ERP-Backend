import { ConsensusEngine } from '../consensus/consensus.engine';
import { Vote } from '../interfaces/consensus.interface';

describe('ConsensusEngine', () => {
  let engine: ConsensusEngine;

  beforeEach(() => {
    engine = new ConsensusEngine();
  });

  it('should reach majority consensus', async () => {
    const votes: Vote[] = [
      { agentName: 'sales', choice: 'approve', confidence: 0.9, weight: 1 },
      { agentName: 'finance', choice: 'approve', confidence: 0.8, weight: 1 },
      { agentName: 'hr', choice: 'reject', confidence: 0.6, weight: 1 },
    ];

    const result = await engine.evaluate({
      question: 'Approve proposal?',
      options: ['approve', 'reject'],
      votes,
      weightStrategy: 'equal',
      organizationId: 'org-1',
    });

    expect(result.reached).toBe(true);
    expect(result.winner).toBe('approve');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should not reach consensus without majority', async () => {
    const votes: Vote[] = [
      { agentName: 'sales', choice: 'option-a', confidence: 0.9, weight: 1 },
      { agentName: 'finance', choice: 'option-b', confidence: 0.8, weight: 1 },
      { agentName: 'hr', choice: 'option-c', confidence: 0.7, weight: 1 },
    ];

    const result = await engine.evaluate({
      question: 'Which option?',
      options: ['option-a', 'option-b', 'option-c'],
      votes,
      weightStrategy: 'equal',
      organizationId: 'org-1',
    });

    expect(result.reached).toBe(false);
    expect(result.winner).toBeUndefined();
  });

  it('should use weighted voting', async () => {
    const votes: Vote[] = [
      { agentName: 'ceo', choice: 'approve', confidence: 0.9, weight: 10 },
      { agentName: 'intern', choice: 'reject', confidence: 0.5, weight: 1 },
    ];

    const result = await engine.evaluate({
      question: 'Approve?',
      options: ['approve', 'reject'],
      votes,
      weightStrategy: 'priority',
      organizationId: 'org-1',
    });

    expect(result.reached).toBe(true);
    expect(result.winner).toBe('approve');
  });

  it('should handle empty votes', async () => {
    const result = await engine.evaluate({
      question: 'Empty vote?',
      options: ['yes', 'no'],
      votes: [],
      weightStrategy: 'equal',
      organizationId: 'org-1',
    });

    expect(result.reached).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('should add votes to pending request', async () => {
    const votes: Vote[] = [{ agentName: 'a1', choice: 'yes', confidence: 0.9, weight: 1 }];

    const initial = await engine.evaluate({
      question: 'Test?',
      options: ['yes', 'no'],
      votes,
      weightStrategy: 'equal',
      requireHumanApproval: true,
      organizationId: 'org-1',
    });

    expect(initial.reached).toBe(true);
    expect(initial.requiresHumanApproval).toBe(true);
  });

  it('should resolve conflict with clear winner', () => {
    const votes: Vote[] = [
      { agentName: 'a1', choice: 'x', confidence: 0.9, weight: 1 },
      { agentName: 'a2', choice: 'y', confidence: 0.8, weight: 1 },
      { agentName: 'a3', choice: 'x', confidence: 0.7, weight: 1 },
    ];

    const result = engine.resolveConflict(votes, 'equal');
    expect(result.reached).toBe(true);
    expect(result.winner).toBe('x');
    expect(result.voteDistribution['x']).toBe(2);
    expect(result.voteDistribution['y']).toBe(1);
  });
});
