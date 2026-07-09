export enum SubscriptionState {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  GRACE_PERIOD = 'GRACE_PERIOD',
  PAST_DUE = 'PAST_DUE',
  SUSPENDED = 'SUSPENDED',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
}

export interface StateTransition {
  from: SubscriptionState[];
  to: SubscriptionState;
}

export const VALID_TRANSITIONS: Record<SubscriptionState, StateTransition> = {
  [SubscriptionState.TRIAL]: {
    from: [],
    to: SubscriptionState.TRIAL,
  },
  [SubscriptionState.ACTIVE]: {
    from: [SubscriptionState.TRIAL, SubscriptionState.GRACE_PERIOD, SubscriptionState.SUSPENDED],
    to: SubscriptionState.ACTIVE,
  },
  [SubscriptionState.GRACE_PERIOD]: {
    from: [SubscriptionState.ACTIVE],
    to: SubscriptionState.GRACE_PERIOD,
  },
  [SubscriptionState.PAST_DUE]: {
    from: [SubscriptionState.ACTIVE, SubscriptionState.GRACE_PERIOD],
    to: SubscriptionState.PAST_DUE,
  },
  [SubscriptionState.SUSPENDED]: {
    from: [SubscriptionState.PAST_DUE, SubscriptionState.GRACE_PERIOD],
    to: SubscriptionState.SUSPENDED,
  },
  [SubscriptionState.CANCELED]: {
    from: [SubscriptionState.ACTIVE, SubscriptionState.GRACE_PERIOD, SubscriptionState.TRIAL],
    to: SubscriptionState.CANCELED,
  },
  [SubscriptionState.EXPIRED]: {
    from: [
      SubscriptionState.TRIAL,
      SubscriptionState.ACTIVE,
      SubscriptionState.GRACE_PERIOD,
      SubscriptionState.PAST_DUE,
      SubscriptionState.SUSPENDED,
      SubscriptionState.CANCELED,
    ],
    to: SubscriptionState.EXPIRED,
  },
};
