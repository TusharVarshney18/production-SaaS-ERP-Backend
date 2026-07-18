export type VoteWeight = 'equal' | 'confidence' | 'priority';

export interface Vote {
  agentName: string;
  choice: string;
  confidence: number;
  reasoning?: string;
  weight: number;
}

export interface ConsensusRequest {
  question: string;
  options: string[];
  votes: Vote[];
  weightStrategy: VoteWeight;
  requiredMajority?: number;
  requireHumanApproval?: boolean;
  organizationId: string;
  timeout?: number;
}

export interface ConsensusResult {
  reached: boolean;
  winner?: string;
  confidence: number;
  voteDistribution: Record<string, number>;
  votes: Vote[];
  requiresHumanApproval: boolean;
  humanApproved?: boolean;
  error?: string;
}

export interface IConsensusEngine {
  evaluate(request: ConsensusRequest): Promise<ConsensusResult>;
  addVote(vote: Vote, requestId: string): Promise<ConsensusResult>;
  approveHuman(requestId: string, approved: boolean): Promise<ConsensusResult>;
  resolveConflict(votes: Vote[], strategy: VoteWeight): ConsensusResult;
}
