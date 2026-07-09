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
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay' as const;

  async createCheckout(_params: CreateCheckoutParams): Promise<CheckoutResponse> {
    throw new Error('Razorpay provider not yet implemented');
  }

  async verifyPayment(_params: VerifyPaymentParams): Promise<PaymentVerificationResponse> {
    throw new Error('Razorpay provider not yet implemented');
  }

  async createSubscription(_params: CreateSubscriptionParams): Promise<SubscriptionResponse> {
    throw new Error('Razorpay provider not yet implemented');
  }

  async cancelSubscription(_params: CancelSubscriptionParams): Promise<void> {
    throw new Error('Razorpay provider not yet implemented');
  }

  async refundPayment(_params: RefundPaymentParams): Promise<RefundResponse> {
    throw new Error('Razorpay provider not yet implemented');
  }

  async handleWebhook(_payload: WebhookPayload): Promise<WebhookHandlerResponse> {
    throw new Error('Razorpay provider not yet implemented');
  }
}
