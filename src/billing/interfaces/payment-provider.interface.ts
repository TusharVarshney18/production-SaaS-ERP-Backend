import {
  CreateCheckoutParams,
  CreateSubscriptionParams,
  CancelSubscriptionParams,
  RefundPaymentParams,
  WebhookPayload,
  CheckoutResponse,
  PaymentVerificationResponse,
  SubscriptionResponse,
  RefundResponse,
  WebhookHandlerResponse,
} from './payment.types';
import { VerifyPaymentParams } from '../providers/payment-gateway.interface';

export interface PaymentProvider {
  readonly name: string;

  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse>;

  verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResponse>;

  createSubscription(params: CreateSubscriptionParams): Promise<SubscriptionResponse>;

  cancelSubscription(params: CancelSubscriptionParams): Promise<void>;

  refundPayment(params: RefundPaymentParams): Promise<RefundResponse>;

  handleWebhook(payload: WebhookPayload): Promise<WebhookHandlerResponse>;
}
