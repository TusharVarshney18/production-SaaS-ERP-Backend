import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual, createHash } from 'crypto';
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
import { RazorpayInstance, RazorpayOrder, RazorpayPayment } from './razorpay.types';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

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

const RAZORPAY_STATUS_MAP: Record<
  string,
  'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
> = {
  created: 'pending',
  authorized: 'pending',
  captured: 'paid',
  settled: 'paid',
  failed: 'failed',
  refunded: 'refunded',
  partially_refunded: 'partially_refunded',
};

@Injectable()
export class RazorpayProvider implements PaymentGateway {
  readonly name = 'razorpay';
  private readonly logger = new Logger(RazorpayProvider.name);
  private readonly razorpay: RazorpayInstance | null;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly processedWebhookIds = new Set<string>();

  constructor(private readonly configService: ConfigService) {
    const keyId = this.configService.get<string>('razorpay.keyId') || '';
    this.keySecret = this.configService.get<string>('razorpay.keySecret') || '';
    this.webhookSecret = this.configService.get<string>('razorpay.webhookSecret') || '';

    if (keyId && this.keySecret) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Razorpay = require('razorpay');
      this.razorpay = new Razorpay({
        key_id: keyId,
        key_secret: this.keySecret,
      }) as RazorpayInstance;
    } else {
      this.razorpay = null;
      this.logger.warn('Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse> {
    this.ensureInitialized();

    const idempotencyKey = createHash('sha256')
      .update(
        `${params.organizationId}:${params.subscriptionId}:${params.planId}:${params.amount}:${params.currency}`,
      )
      .digest('hex')
      .substring(0, 24);

    const receipt = `rcpt_${idempotencyKey.substring(0, 12)}`;
    const notes: Record<string, string> = {
      ...(params.metadata ?? {}),
      organization_id: params.organizationId,
      subscription_id: params.subscriptionId,
      plan_id: params.planId,
    };

    let order: RazorpayOrder;
    try {
      order = await withRetry(() =>
        (this.razorpay as RazorpayInstance).orders.create(
          { amount: params.amount, currency: params.currency, receipt, notes },
          { headers: { 'X-Razorpay-Idempotency-Key': idempotencyKey } },
        ),
      );
    } catch (error) {
      this.logger.error(
        'Failed to create Razorpay order',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException('Payment service unavailable. Please try again.');
    }

    this.logger.log(
      `Razorpay order created: ${order.id}, amount=${params.amount} ${params.currency}`,
    );

    return {
      checkoutUrl: `https://checkout.razorpay.com/v1/${order.id}`,
      sessionId: order.id,
      provider: 'razorpay',
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResponse> {
    this.ensureInitialized();

    if (params.signature && params.sessionId && params.paymentId) {
      const expectedSignature = createHmac('sha256', this.keySecret)
        .update(`${params.sessionId}|${params.paymentId}`)
        .digest('hex');

      if (!safeCompare(expectedSignature, params.signature)) {
        this.logger.warn(
          `Payment signature verification failed: session=${params.sessionId}, payment=${params.paymentId}`,
        );
        return {
          verified: false,
          paymentId: params.paymentId,
          status: 'failed',
          amount: 0,
          currency: 'INR',
          provider: 'razorpay',
        };
      }
    }

    if (!params.paymentId) {
      this.logger.warn('verifyPayment called without paymentId');
      return {
        verified: false,
        paymentId: '',
        status: 'failed',
        amount: 0,
        currency: 'INR',
        provider: 'razorpay',
      };
    }

    const paymentId = params.paymentId;
    let payment: RazorpayPayment;
    try {
      payment = await withRetry(() =>
        (this.razorpay as RazorpayInstance).payments.fetch(paymentId),
      );
    } catch (error) {
      this.logger.error(
        `Failed to fetch Razorpay payment: ${paymentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException('Unable to verify payment at this time.');
    }

    const mappedStatus = RAZORPAY_STATUS_MAP[payment.status] ?? 'failed';
    const verified = mappedStatus === 'paid';

    this.logger.log(
      `Razorpay payment verified: payment=${payment.id}, status=${payment.status}, verified=${verified}`,
    );

    return {
      verified,
      paymentId: payment.id,
      status: mappedStatus,
      amount: payment.amount,
      currency: payment.currency,
      provider: 'razorpay',
    };
  }

  async refund(params: RefundParams): Promise<RefundResponse> {
    this.ensureInitialized();

    const refundOptions: { amount?: number; notes?: Record<string, string> } = {};
    if (params.amount !== undefined) {
      refundOptions.amount = params.amount;
    }
    if (params.metadata) {
      refundOptions.notes = params.metadata;
    }

    let refund: { id: string; amount: number; status: string };
    try {
      refund = await withRetry(() =>
        (this.razorpay as RazorpayInstance).payments.refund(params.paymentId, refundOptions),
      );
    } catch (error) {
      this.logger.error(
        `Failed to refund Razorpay payment: ${params.paymentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException('Refund failed. Please try again.');
    }

    this.logger.log(
      `Razorpay refund processed: refund=${refund.id}, payment=${params.paymentId}${params.amount ? `, amount=${params.amount}` : ''}`,
    );

    return {
      refundId: refund.id,
      paymentId: params.paymentId,
      amount: refund.amount,
      status: refund.status,
      provider: 'razorpay',
    };
  }

  async handleWebhook(payload: WebhookPayload): Promise<WebhookHandlerResponse> {
    if (this.webhookSecret && payload.signature) {
      const rawBody =
        typeof payload.rawBody === 'string' ? payload.rawBody : JSON.stringify(payload.rawBody);

      const expectedSignature = createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (!safeCompare(expectedSignature, payload.signature)) {
        this.logger.warn('Razorpay webhook signature verification failed');
        return {
          processed: false,
          event: 'verification_failed',
          data: { error: 'Invalid webhook signature' },
        };
      }
    }

    let body: Record<string, unknown> | null = null;
    if (typeof payload.rawBody === 'string') {
      try {
        body = JSON.parse(payload.rawBody);
      } catch {
        return {
          processed: false,
          event: 'parse_failed',
          data: { error: 'Invalid JSON in webhook body' },
        };
      }
    } else {
      body = payload.rawBody as Record<string, unknown> | null;
    }

    if (!body) {
      return {
        processed: false,
        event: 'empty_body',
        data: { error: 'Webhook body is empty' },
      };
    }

    const eventId = (body.id as string) || '';
    if (eventId && this.processedWebhookIds.has(eventId)) {
      this.logger.log(`Duplicate webhook skipped: event_id=${eventId}`);
      return {
        processed: true,
        event: (body.event as string) ?? 'unknown',
        data: { event: body.event ?? 'unknown', raw: body, duplicate_skipped: true },
      };
    }

    if (eventId) {
      this.processedWebhookIds.add(eventId);
      if (this.processedWebhookIds.size > 10000) {
        this.processedWebhookIds.clear();
      }
    }

    const event = (body.event as string) ?? 'unknown';
    this.logger.log(`Razorpay webhook received: event=${event}, id=${eventId}`);

    return {
      processed: true,
      event,
      data: { event, raw: body, event_id: eventId },
    };
  }

  private ensureInitialized(): void {
    if (!this.razorpay) {
      throw new ServiceUnavailableException(
        'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.',
      );
    }
  }
}
