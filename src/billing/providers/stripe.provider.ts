import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../interfaces/payment-provider.interface';
import {
  CreateCheckoutParams,
  VerifyPaymentParams,
  CreateSubscriptionParams,
  CancelSubscriptionParams,
  RefundPaymentParams,
  WebhookPayload,
  CheckoutResponse,
  PaymentVerificationResponse,
  SubscriptionResponse,
  RefundResponse,
  WebhookHandlerResponse,
} from '../interfaces/payment.types';

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const;

  async createCheckout(_params: CreateCheckoutParams): Promise<CheckoutResponse> {
    throw new Error('Stripe provider not yet implemented');
  }

  async verifyPayment(_params: VerifyPaymentParams): Promise<PaymentVerificationResponse> {
    throw new Error('Stripe provider not yet implemented');
  }

  async createSubscription(_params: CreateSubscriptionParams): Promise<SubscriptionResponse> {
    throw new Error('Stripe provider not yet implemented');
  }

  async cancelSubscription(_params: CancelSubscriptionParams): Promise<void> {
    throw new Error('Stripe provider not yet implemented');
  }

  async refundPayment(_params: RefundPaymentParams): Promise<RefundResponse> {
    throw new Error('Stripe provider not yet implemented');
  }

  async handleWebhook(_payload: WebhookPayload): Promise<WebhookHandlerResponse> {
    throw new Error('Stripe provider not yet implemented');
  }
}
