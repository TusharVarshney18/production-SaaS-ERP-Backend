export type DelegationStrategyType =
  'round-robin' | 'least-loaded' | 'capability-match' | 'priority';

export interface DelegationStrategyConfig {
  type: DelegationStrategyType;
  fallbackEnabled: boolean;
  maxRetries: number;
}

export class DelegationStrategy {
  static readonly DEFAULT: DelegationStrategyConfig = {
    type: 'capability-match',
    fallbackEnabled: true,
    maxRetries: 1,
  };

  static readonly LEAST_LOADED: DelegationStrategyConfig = {
    type: 'least-loaded',
    fallbackEnabled: true,
    maxRetries: 2,
  };

  static readonly PRIORITY_BASED: DelegationStrategyConfig = {
    type: 'priority',
    fallbackEnabled: true,
    maxRetries: 1,
  };
}
