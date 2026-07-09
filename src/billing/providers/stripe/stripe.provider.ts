import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  PaymentGateway,
  VerifyPaymentParams,
  PaymentVerificationResponse,
  RefundParams,
  RefundResponse,
  WebhookPayload,
  WebhookHandlerResponse,
} from '../payment-gateway.interface';
import { CreateCheckoutParams, CheckoutResponse } from '../../interfaces/payment.types';

@Injectable()
export class StripeProvider implements PaymentGateway {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeProvider.name);

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse> {
    const sessionId = `cs_${randomUUID().replace(/-/g, '').substring(0, 24)}`;

    this.logger.log(
      `[MOCK] Stripe checkout created: session=${sessionId}, amount=${params.amount} ${params.currency}`,
    );

    return {
      checkoutUrl: `https://checkout.stripe.com/c/pay/${sessionId}`,
      sessionId,
      provider: 'stripe',
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResponse> {
    const paymentId = params.paymentId ?? `pi_${randomUUID().replace(/-/g, '').substring(0, 24)}`;

    this.logger.log(
      `[MOCK] Stripe payment verified: payment=${paymentId}, session=${params.sessionId}`,
    );

    return {
      verified: true,
      paymentId,
      status: 'paid',
      amount: 0,
      currency: 'USD',
      provider: 'stripe',
    };
  }

  async refund(params: RefundParams): Promise<RefundResponse> {
    const refundId = `re_${randomUUID().replace(/-/g, '').substring(0, 24)}`;

    this.logger.log(
      `[MOCK] Stripe refund processed: refund=${refundId}, payment=${params.paymentId}${params.amount ? `, amount=${params.amount}` : ''}`,
    );

    return {
      refundId,
      paymentId: params.paymentId,
      amount: params.amount ?? 0,
      status: 'succeeded',
      provider: 'stripe',
    };
  }

  async handleWebhook(payload: WebhookPayload): Promise<WebhookHandlerResponse> {
    const body = payload.rawBody as Record<string, unknown> | null;
    const type = (body?.type as string) ?? 'unknown';

    this.logger.log(`[MOCK] Stripe webhook received: type=${type}`);

    return {
      processed: true,
      event: type,
      data: { type, raw: body ?? {} },
    };
  }
}
