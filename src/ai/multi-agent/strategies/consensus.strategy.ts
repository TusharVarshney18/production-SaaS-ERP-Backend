export type ConsensusStrategyType = 'majority' | 'supermajority' | 'unanimous' | 'weighted';

export interface ConsensusStrategyConfig {
  type: ConsensusStrategyType;
  requiredRatio: number;
  requireHumanApproval: boolean;
  timeout: number;
}

export class ConsensusStrategy {
  static readonly SIMPLE_MAJORITY: ConsensusStrategyConfig = {
    type: 'majority',
    requiredRatio: 0.5,
    requireHumanApproval: false,
    timeout: 30000,
  };

  static readonly SUPER_MAJORITY: ConsensusStrategyConfig = {
    type: 'supermajority',
    requiredRatio: 0.66,
    requireHumanApproval: false,
    timeout: 30000,
  };

  static readonly UNANIMOUS: ConsensusStrategyConfig = {
    type: 'unanimous',
    requiredRatio: 1.0,
    requireHumanApproval: true,
    timeout: 60000,
  };

  static readonly WEIGHTED: ConsensusStrategyConfig = {
    type: 'weighted',
    requiredRatio: 0.5,
    requireHumanApproval: false,
    timeout: 30000,
  };
}
