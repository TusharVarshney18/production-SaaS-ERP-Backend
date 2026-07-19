import { Injectable, Logger } from '@nestjs/common';
import {
  IConsensusEngine,
  ConsensusRequest,
  ConsensusResult,
  Vote,
  VoteWeight,
} from '../interfaces/consensus.interface';
import { generateId } from '../../constants';

@Injectable()
export class ConsensusEngine implements IConsensusEngine {
  private readonly logger = new Logger(ConsensusEngine.name);
  private readonly pendingRequests = new Map<
    string,
    { request: ConsensusRequest; votes: Vote[] }
  >();
  private readonly humanApprovals = new Map<string, boolean>();

  async evaluate(request: ConsensusRequest): Promise<ConsensusResult> {
    const requestId = generateId('consensus');
    const result = this.resolveConflict(request.votes, request.weightStrategy);
    result.requiresHumanApproval = request.requireHumanApproval || false;

    if (result.requiresHumanApproval && result.reached) {
      this.pendingRequests.set(requestId, { request, votes: request.votes });
      result.humanApproved = false;
    }

    this.logger.log(
      `Consensus evaluated: ${result.reached ? 'REACHED' : 'NOT REACHED'} ` +
        `(winner: ${result.winner || 'none'}, confidence: ${result.confidence.toFixed(2)})`,
    );

    return result;
  }

  async addVote(vote: Vote, requestId: string): Promise<ConsensusResult> {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      throw new Error(`No pending consensus request found: ${requestId}`);
    }

    pending.votes.push(vote);
    const result = this.resolveConflict(pending.votes, pending.request.weightStrategy);
    result.requiresHumanApproval = pending.request.requireHumanApproval || false;

    if (!result.requiresHumanApproval && result.reached) {
      this.pendingRequests.delete(requestId);
    }

    return result;
  }

  async approveHuman(requestId: string, approved: boolean): Promise<ConsensusResult> {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      throw new Error(`No pending consensus request found: ${requestId}`);
    }

    this.humanApprovals.set(requestId, approved);
    this.pendingRequests.delete(requestId);

    const result = this.resolveConflict(pending.votes, pending.request.weightStrategy);
    result.requiresHumanApproval = true;
    result.humanApproved = approved;

    if (!approved) {
      result.reached = false;
      result.winner = undefined;
    }

    return result;
  }

  resolveConflict(votes: Vote[], strategy: VoteWeight): ConsensusResult {
    if (votes.length === 0) {
      return {
        reached: false,
        confidence: 0,
        voteDistribution: {},
        votes: [],
        requiresHumanApproval: false,
      };
    }

    const weightedVotes = new Map<string, number>();
    let totalWeight = 0;

    for (const vote of votes) {
      let weight = 1;
      switch (strategy) {
        case 'confidence':
          weight = vote.confidence;
          break;
        case 'priority':
          weight = vote.weight;
          break;
        case 'equal':
        default:
          weight = 1;
          break;
      }

      weightedVotes.set(vote.choice, (weightedVotes.get(vote.choice) || 0) + weight);
      totalWeight += weight;
    }

    const sortedChoices = [...weightedVotes.entries()].sort((a, b) => b[1] - a[1]);
    const winner = sortedChoices[0]?.[0] || '';
    const winnerWeight = sortedChoices[0]?.[1] || 0;
    const majorityThreshold = totalWeight * 0.5;

    const reached = winnerWeight > majorityThreshold;
    const confidence = totalWeight > 0 ? winnerWeight / totalWeight : 0;

    const voteDistribution: Record<string, number> = {};
    for (const [choice, weight] of weightedVotes) {
      voteDistribution[choice] = weight;
    }

    return {
      reached,
      winner: reached ? winner : undefined,
      confidence,
      voteDistribution,
      votes,
      requiresHumanApproval: false,
    };
  }
}
