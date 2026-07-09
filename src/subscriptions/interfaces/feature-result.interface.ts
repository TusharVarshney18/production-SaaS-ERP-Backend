export interface FeatureResult {
  slug: string;
  name: string;
  group: string;
  value: string;
  isAvailable: boolean;
}

export interface FeatureCheckResult {
  slug: string;
  enabled: boolean;
  value: string | null;
}
