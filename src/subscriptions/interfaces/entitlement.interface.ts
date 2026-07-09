export interface EntitlementResult {
  allowed: boolean;
  reason: string | null;
  featureSlug: string;
  metadata?: Record<string, unknown>;
}
