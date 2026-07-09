import { CreateCheckoutParams, CheckoutResponse } from '../interfaces/payment.types';

export interface VerifyPaymentParams {
  sessionId: string;
  paymentId?: string;
  signature?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentVerificationResponse {
  verified: boolean;
  paymentId: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
  amount: number;
  currency: string;
  provider: string;
}

export interface RefundParams {
  paymentId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, string>;
}

export interface RefundResponse {
  refundId: string;
  paymentId: string;
  amount: number;
  status: string;
  provider: string;
}

export interface WebhookPayload {
  rawBody: unknown;
  headers: Record<string, string>;
  signature?: string;
}

export interface WebhookHandlerResponse {
  processed: boolean;
  event: string;
  data: Record<string, unknown>;
}

export interface PaymentGateway {
  readonly name: string;

  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse>;

  verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResponse>;

  refund(params: RefundParams): Promise<RefundResponse>;

  handleWebhook(payload: WebhookPayload): Promise<WebhookHandlerResponse>;
}
