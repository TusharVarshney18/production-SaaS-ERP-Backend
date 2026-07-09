export class StripeCheckoutDto {
  amount!: number;
  currency!: string;
  description?: string;
  metadata?: Record<string, string>;
  success_url!: string;
  cancel_url!: string;
  customer_email?: string;
}

export class StripeVerificationDto {
  payment_intent!: string;
  payment_intent_client_secret?: string;
  status?: string;
}

export class StripeRefundDto {
  payment_intent!: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, string>;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
  created: number;
}

export interface StripeSessionResponse {
  id: string;
  object: string;
  url: string;
  amount_total: number;
  currency: string;
  status: string;
  payment_status: string;
  customer_email: string | null;
}
