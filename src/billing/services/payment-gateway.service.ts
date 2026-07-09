import { Injectable, Logger } from '@nestjs/common';
import { PaymentProviderFactory } from '../providers/payment-provider.factory';
import { CreateCheckoutParams } from '../interfaces/payment.types';
import {
  VerifyPaymentParams,
  RefundParams,
  WebhookPayload,
} from '../providers/payment-gateway.interface';

export interface PaymentGatewayRequest {
  provider: string;
}

export interface CheckoutRequest extends PaymentGatewayRequest {
  amount: number;
  currency: string;
  organizationId: string;
  subscriptionId: string;
  planId: string;
  description?: string;
  metadata?: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

export interface VerifyRequest extends PaymentGatewayRequest {
  sessionId: string;
  paymentId?: string;
  signature?: string;
  metadata?: Record<string, unknown>;
}

export interface RefundRequest extends PaymentGatewayRequest {
  paymentId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, string>;
}

export interface WebhookRequest extends PaymentGatewayRequest {
  rawBody: unknown;
  headers: Record<string, string>;
  signature?: string;
}

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  constructor(private readonly factory: PaymentProviderFactory) {}

  getAvailableProviders(): string[] {
    return this.factory.getRegisteredProviders();
  }

  async createCheckout(request: CheckoutRequest) {
    const provider = this.getProvider(request.provider);
    const params: CreateCheckoutParams = {
      amount: request.amount,
      currency: request.currency as CreateCheckoutParams['currency'],
      organizationId: request.organizationId,
      subscriptionId: request.subscriptionId,
      planId: request.planId,
      description: request.description,
      metadata: request.metadata,
      successUrl: request.successUrl,
      cancelUrl: request.cancelUrl,
    };
    return provider.createCheckout(params);
  }

  async verifyPayment(request: VerifyRequest) {
    const provider = this.getProvider(request.provider);
    const params: VerifyPaymentParams = {
      sessionId: request.sessionId,
      paymentId: request.paymentId,
      signature: request.signature,
      metadata: request.metadata,
    };
    return provider.verifyPayment(params);
  }

  async refund(request: RefundRequest) {
    const provider = this.getProvider(request.provider);
    const params: RefundParams = {
      paymentId: request.paymentId,
      amount: request.amount,
      reason: request.reason,
      metadata: request.metadata,
    };
    return provider.refund(params);
  }

  async handleWebhook(request: WebhookRequest) {
    const provider = this.getProvider(request.provider);
    const payload: WebhookPayload = {
      rawBody: request.rawBody,
      headers: request.headers,
      signature: request.signature,
    };
    return provider.handleWebhook(payload);
  }

  private getProvider(name: string) {
    return this.factory.getProvider(name);
  }
}
