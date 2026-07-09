import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
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
import { StripeInstance, StripePaymentIntent } from './stripe.types';

async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 200;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

const STRIPE_PI_STATUS_MAP: Record<
  string,
  'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
> = {
  succeeded: 'paid',
  processing: 'pending',
  requires_payment_method: 'pending',
  requires_confirmation: 'pending',
  requires_action: 'pending',
  canceled: 'failed',
};

@Injectable()
export class StripeProvider implements PaymentGateway {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeProvider.name);
  private readonly stripe: StripeInstance | null;
  private readonly webhookSecret: string;
  private readonly processedWebhookIds = new Set<string>();

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('stripe.secretKey') || '';
    this.webhookSecret = this.configService.get<string>('stripe.webhookSecret') || '';

    if (secretKey) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Stripe = require('stripe');
      this.stripe = new Stripe(secretKey, { apiVersion: null }) as StripeInstance;
    } else {
      this.stripe = null;
      this.logger.warn('Stripe not configured. Set STRIPE_SECRET_KEY environment variable.');
    }
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse> {
    this.ensureInitialized();

    const idempotencyKey = createHash('sha256')
      .update(
        `${params.organizationId}:${params.subscriptionId}:${params.planId}:${params.amount}:${params.currency}:checkout`,
      )
      .digest('hex')
      .substring(0, 24);

    const sessionParams: Record<string, unknown> = {
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: params.description || `Subscription - ${params.planId}`,
              metadata: {
                plan_id: params.planId,
              },
            },
            unit_amount: params.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        organization_id: params.organizationId,
        subscription_id: params.subscriptionId,
        plan_id: params.planId,
        ...(params.metadata ?? {}),
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    };

    let session: { id: string; url: string | null };
    try {
      session = await withRetry(() =>
        (this.stripe as StripeInstance).checkout.sessions.create(sessionParams, {
          idempotencyKey,
        }),
      );
    } catch (error) {
      this.logger.error(
        'Failed to create Stripe checkout session',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException('Payment service unavailable. Please try again.');
    }

    this.logger.log(
      `Stripe checkout session created: ${session.id}, amount=${params.amount} ${params.currency}`,
    );

    return {
      checkoutUrl: session.url || `https://checkout.stripe.com/pay/${session.id}`,
      sessionId: session.id,
      provider: 'stripe',
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResponse> {
    this.ensureInitialized();

    let paymentIntentId = params.paymentId;

    if (!paymentIntentId && params.sessionId) {
      try {
        const session = await withRetry(() =>
          (this.stripe as StripeInstance).checkout.sessions.retrieve(params.sessionId),
        );
        paymentIntentId = session.payment_intent || undefined;
      } catch (error) {
        this.logger.error(
          `Failed to retrieve Stripe checkout session: ${params.sessionId}`,
          error instanceof Error ? error.stack : undefined,
        );
        throw new ServiceUnavailableException('Unable to verify payment at this time.');
      }
    }

    if (!paymentIntentId) {
      this.logger.warn('verifyPayment called without paymentId or retrievable session');
      return {
        verified: false,
        paymentId: '',
        status: 'failed',
        amount: 0,
        currency: 'USD',
        provider: 'stripe',
      };
    }

    let paymentIntent: StripePaymentIntent;
    try {
      paymentIntent = await withRetry(() =>
        (this.stripe as StripeInstance).paymentIntents.retrieve(paymentIntentId as string),
      );
    } catch (error) {
      this.logger.error(
        `Failed to retrieve Stripe payment intent: ${paymentIntentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException('Unable to verify payment at this time.');
    }

    const rawStatus = paymentIntent.status;
    const mappedStatus = STRIPE_PI_STATUS_MAP[rawStatus] ?? 'failed';
    const verified = mappedStatus === 'paid';

    this.logger.log(
      `Stripe payment verified: pi=${paymentIntent.id}, status=${rawStatus}, verified=${verified}`,
    );

    return {
      verified,
      paymentId: paymentIntent.id,
      status: mappedStatus,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      provider: 'stripe',
    };
  }

  async refund(params: RefundParams): Promise<RefundResponse> {
    this.ensureInitialized();

    const idempotencyKey = createHash('sha256')
      .update(`refund:${params.paymentId}:${params.amount ?? 'full'}:${params.reason ?? ''}`)
      .digest('hex')
      .substring(0, 24);

    const refundParams: {
      payment_intent: string;
      amount?: number;
      metadata?: Record<string, string>;
    } = {
      payment_intent: params.paymentId,
    };
    if (params.amount !== undefined) {
      refundParams.amount = params.amount;
    }
    if (params.metadata) {
      refundParams.metadata = params.metadata;
    }

    let refund: { id: string; amount: number; status: string };
    try {
      refund = await withRetry(() =>
        (this.stripe as StripeInstance).refunds.create(refundParams, { idempotencyKey }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to refund Stripe payment: ${params.paymentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException('Refund failed. Please try again.');
    }

    this.logger.log(
      `Stripe refund processed: refund=${refund.id}, payment=${params.paymentId}${params.amount ? `, amount=${params.amount}` : ''}`,
    );

    return {
      refundId: refund.id,
      paymentId: params.paymentId,
      amount: refund.amount,
      status: refund.status,
      provider: 'stripe',
    };
  }

  async handleWebhook(payload: WebhookPayload): Promise<WebhookHandlerResponse> {
    if (!this.webhookSecret) {
      this.logger.warn(
        'Stripe webhook secret not configured; accepting webhook without verification',
      );
      let body: Record<string, unknown> | null = null;
      if (typeof payload.rawBody === 'string') {
        try {
          body = JSON.parse(payload.rawBody);
        } catch {
          body = null;
        }
      } else {
        body = payload.rawBody as Record<string, unknown> | null;
      }
      const event = (body?.type as string) ?? 'unknown';
      return {
        processed: true,
        event,
        data: { event, raw: body ?? {} },
      };
    }

    const rawBodyStr =
      typeof payload.rawBody === 'string' ? payload.rawBody : JSON.stringify(payload.rawBody);

    const sigHeader = payload.headers['stripe-signature'] || payload.signature || '';
    if (!sigHeader) {
      this.logger.warn('Stripe webhook missing signature header');
      return {
        processed: false,
        event: 'verification_failed',
        data: { error: 'Missing Stripe signature header' },
      };
    }

    try {
      const event = (this.stripe as StripeInstance).webhooks.constructEvent(
        rawBodyStr,
        sigHeader,
        this.webhookSecret,
      );

      const eventId = event.id || '';
      if (eventId && this.processedWebhookIds.has(eventId)) {
        this.logger.log(`Duplicate Stripe webhook skipped: event_id=${eventId}`);
        return {
          processed: true,
          event: event.type,
          data: { event: event.type, raw: event.data.object, duplicate_skipped: true },
        };
      }

      if (eventId) {
        this.processedWebhookIds.add(eventId);
        if (this.processedWebhookIds.size > 10000) {
          this.processedWebhookIds.clear();
        }
      }

      this.logger.log(`Stripe webhook received: event=${event.type}, id=${eventId}`);

      return {
        processed: true,
        event: event.type,
        data: { event: event.type, raw: event.data.object, event_id: eventId },
      };
    } catch (error) {
      this.logger.warn('Stripe webhook signature verification failed');
      return {
        processed: false,
        event: 'verification_failed',
        data: { error: 'Invalid webhook signature' },
      };
    }
  }

  private ensureInitialized(): void {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.',
      );
    }
  }
}
