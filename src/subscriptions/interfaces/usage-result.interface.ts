export interface UsageResult {
  featureSlug: string;
  featureName: string;
  period: string;
  usage: number;
  softLimit: number | null;
  hardLimit: number | null;
  remaining: number | null;
  withinLimits: boolean;
  isSoftLimitReached: boolean;
}

export interface UsageCheckResult {
  withinLimits: boolean;
  current: number;
  limit: number | null;
  remaining: number | null;
  message: string | null;
}
