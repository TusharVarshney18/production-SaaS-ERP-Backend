export interface StripeCheckoutSession {
  id: string;
  url: string | null;
  amount_total: number;
  currency: string;
  payment_status: string;
  status: string | null;
  payment_intent: string | null;
  customer_email: string | null;
  metadata: Record<string, string>;
}

export interface StripePaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  charges?: {
    data: Array<{ id: string; amount: number; refunded: boolean }>;
  };
}

export interface StripeRefund {
  id: string;
  amount: number;
  status: string;
  payment_intent: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
  created: number;
}

export interface StripeInstance {
  checkout: {
    sessions: {
      create(
        params: Record<string, unknown>,
        options?: { idempotencyKey?: string },
      ): Promise<StripeCheckoutSession>;
      retrieve(sessionId: string): Promise<StripeCheckoutSession>;
    };
  };
  paymentIntents: {
    retrieve(paymentIntentId: string): Promise<StripePaymentIntent>;
  };
  refunds: {
    create(
      params: { payment_intent: string; amount?: number; metadata?: Record<string, string> },
      options?: { idempotencyKey?: string },
    ): Promise<StripeRefund>;
  };
  webhooks: {
    constructEvent(payload: string | Buffer, signature: string, secret: string): StripeWebhookEvent;
  };
}
