export type PaymentProviderName =
  'razorpay' | 'stripe' | 'paypal' | 'phonepe' | 'cashfree' | 'payu' | 'paddle';

export type PaymentCurrency = 'INR' | 'USD' | 'EUR' | 'GBP';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';

export interface CreateCheckoutParams {
  amount: number;
  currency: PaymentCurrency;
  organizationId: string;
  subscriptionId: string;
  planId: string;
  description?: string;
  metadata?: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
  provider: PaymentProviderName;
}

export interface PaymentVerificationResponse {
  verified: boolean;
  paymentId: string;
  status: PaymentStatus;
  amount: number;
  currency: PaymentCurrency;
  provider: PaymentProviderName;
}

export interface CreateSubscriptionParams {
  organizationId: string;
  planId: string;
  planName: string;
  amount: number;
  currency: PaymentCurrency;
  interval: 'monthly' | 'yearly';
  trialPeriodDays?: number;
  metadata?: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

export interface SubscriptionResponse {
  subscriptionId: string;
  providerSubscriptionId: string;
  status: string;
  provider: PaymentProviderName;
}

export interface CancelSubscriptionParams {
  providerSubscriptionId: string;
  provider: PaymentProviderName;
  atPeriodEnd?: boolean;
  metadata?: Record<string, string>;
}

export interface RefundPaymentParams {
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
  provider: PaymentProviderName;
}

export interface WebhookPayload {
  provider: PaymentProviderName;
  rawBody: unknown;
  headers: Record<string, string>;
  signature?: string;
}

export interface WebhookHandlerResponse {
  processed: boolean;
  event: string;
  data: Record<string, unknown>;
}

export interface ProviderConfig {
  name: PaymentProviderName;
  isActive: boolean;
  supportedCurrencies: PaymentCurrency[];
  priority: number;
}
