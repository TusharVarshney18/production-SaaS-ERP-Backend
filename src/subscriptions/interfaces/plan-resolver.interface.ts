export interface ResolvedPlan {
  planId: string;
  planName: string;
  planSlug: string;
  billingInterval: string;
  price: number;
  currency: string;
  isActive: boolean;
}

export interface BillingCycle {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  daysRemaining: number;
  isExpired: boolean;
}

export interface RenewalDate {
  nextRenewalDate: Date;
  daysUntilRenewal: number;
  interval: string;
}
