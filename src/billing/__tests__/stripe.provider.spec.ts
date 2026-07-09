import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { StripeProvider } from '../providers/stripe/stripe.provider';

const mockSessionsCreate = jest.fn();
const mockSessionsRetrieve = jest.fn();
const mockPaymentIntentsRetrieve = jest.fn();
const mockRefundsCreate = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: { create: mockSessionsCreate, retrieve: mockSessionsRetrieve },
    },
    paymentIntents: { retrieve: mockPaymentIntentsRetrieve },
    refunds: { create: mockRefundsCreate },
    webhooks: { constructEvent: mockConstructEvent },
  }));
});

describe('StripeProvider', () => {
  let provider: StripeProvider;
  let configService: jest.Mocked<ConfigService>;

  const mockSession = {
    id: 'cs_test_abc123',
    url: 'https://checkout.stripe.com/pay/cs_test_abc123',
    amount_total: 2900,
    currency: 'usd',
    payment_status: 'paid',
    status: 'complete',
    payment_intent: 'pi_test_intent_abc',
    customer_email: 'test@example.com',
    metadata: {},
  };

  const mockPaymentIntent = {
    id: 'pi_test_intent_abc',
    amount: 2900,
    currency: 'usd',
    status: 'succeeded',
    charges: { data: [{ id: 'ch_test', amount: 2900, refunded: false }] },
  };

  const mockRefund = {
    id: 're_test_refund_abc',
    amount: 2900,
    status: 'succeeded',
    payment_intent: 'pi_test_intent_abc',
  };

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    configService.get.mockImplementation((key: string) => {
      const map: Record<string, string> = {
        'stripe.secretKey': 'sk_test_key',
        'stripe.webhookSecret': 'whsec_test',
        'stripe.publishableKey': 'pk_test_key',
      };
      return map[key] ?? undefined;
    });

    provider = new StripeProvider(configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('name', () => {
    it('should be stripe', () => {
      expect(provider.name).toBe('stripe');
    });
  });

  describe('createCheckout', () => {
    it('should create a Stripe checkout session and return response', async () => {
      mockSessionsCreate.mockResolvedValue(mockSession);

      const result = await provider.createCheckout({
        amount: 2900,
        currency: 'USD',
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        description: 'Growth plan',
      });

      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          line_items: expect.arrayContaining([
            expect.objectContaining({
              price_data: expect.objectContaining({
                currency: 'usd',
                unit_amount: 2900,
              }),
              quantity: 1,
            }),
          ]),
          metadata: expect.objectContaining({
            organization_id: 'org-1',
            subscription_id: 'sub-1',
            plan_id: 'plan-1',
          }),
          success_url: 'https://example.com/success',
          cancel_url: 'https://example.com/cancel',
        }),
        expect.objectContaining({
          idempotencyKey: expect.any(String),
        }),
      );

      expect(result.provider).toBe('stripe');
      expect(result.sessionId).toBe('cs_test_abc123');
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_test_abc123');
    });

    it('should pass same idempotency key for identical checkout params', async () => {
      mockSessionsCreate.mockResolvedValue(mockSession);

      const params = {
        amount: 1000,
        currency: 'USD' as const,
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      await provider.createCheckout(params);
      const firstKey = mockSessionsCreate.mock.calls[0][1]?.idempotencyKey;

      mockSessionsCreate.mockClear();
      await provider.createCheckout(params);
      const secondKey = mockSessionsCreate.mock.calls[0][1]?.idempotencyKey;

      expect(firstKey).toBe(secondKey);
    });

    it('should use fallback checkout URL when session URL is null', async () => {
      mockSessionsCreate.mockResolvedValue({ ...mockSession, url: null });

      const result = await provider.createCheckout({
        amount: 1000,
        currency: 'USD' as const,
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.checkoutUrl).toContain('checkout.stripe.com');
    });

    it('should throw if stripe is not configured', async () => {
      configService.get.mockReturnValue(undefined);
      const unconfiguredProvider = new StripeProvider(configService);

      await expect(
        unconfiguredProvider.createCheckout({
          amount: 100,
          currency: 'USD' as const,
          organizationId: 'org-1',
          subscriptionId: 'sub-1',
          planId: 'plan-1',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should retry on transient failure and succeed', async () => {
      mockSessionsCreate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSession);

      const result = await provider.createCheckout({
        amount: 2900,
        currency: 'USD' as const,
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(mockSessionsCreate).toHaveBeenCalledTimes(2);
      expect(result.sessionId).toBe('cs_test_abc123');
    });

    it('should throw ServiceUnavailableException after all retries exhausted', async () => {
      mockSessionsCreate.mockRejectedValue(new Error('API unavailable'));

      await expect(
        provider.createCheckout({
          amount: 100,
          currency: 'USD' as const,
          organizationId: 'org-1',
          subscriptionId: 'sub-1',
          planId: 'plan-1',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(mockSessionsCreate.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('verifyPayment', () => {
    it('should verify payment by payment intent ID', async () => {
      mockPaymentIntentsRetrieve.mockResolvedValue(mockPaymentIntent);

      const result = await provider.verifyPayment({
        sessionId: 'cs_test',
        paymentId: 'pi_test_intent_abc',
      });

      expect(mockPaymentIntentsRetrieve).toHaveBeenCalledWith('pi_test_intent_abc');
      expect(result.verified).toBe(true);
      expect(result.status).toBe('paid');
      expect(result.amount).toBe(2900);
      expect(result.currency).toBe('USD');
      expect(result.provider).toBe('stripe');
    });

    it('should retrieve session to get payment intent when only sessionId given', async () => {
      mockSessionsRetrieve.mockResolvedValue(mockSession);
      mockPaymentIntentsRetrieve.mockResolvedValue(mockPaymentIntent);

      const result = await provider.verifyPayment({
        sessionId: 'cs_test_abc123',
      });

      expect(mockSessionsRetrieve).toHaveBeenCalledWith('cs_test_abc123');
      expect(mockPaymentIntentsRetrieve).toHaveBeenCalledWith('pi_test_intent_abc');
      expect(result.verified).toBe(true);
    });

    it('should return failed when no paymentId and session has no payment_intent', async () => {
      mockSessionsRetrieve.mockResolvedValue({ ...mockSession, payment_intent: null });

      const result = await provider.verifyPayment({
        sessionId: 'cs_test_empty',
      });

      expect(result.verified).toBe(false);
      expect(result.status).toBe('failed');
    });

    it('should return failed when neither paymentId nor sessionId provided', async () => {
      const result = await provider.verifyPayment({ sessionId: '' });

      expect(result.verified).toBe(false);
      expect(result.status).toBe('failed');
    });

    it('should handle failed payment intent status', async () => {
      mockPaymentIntentsRetrieve.mockResolvedValue({ ...mockPaymentIntent, status: 'canceled' });

      const result = await provider.verifyPayment({
        sessionId: 'cs_test',
        paymentId: 'pi_failed',
      });

      expect(result.verified).toBe(false);
      expect(result.status).toBe('failed');
    });

    it('should handle processing payment intent status', async () => {
      mockPaymentIntentsRetrieve.mockResolvedValue({ ...mockPaymentIntent, status: 'processing' });

      const result = await provider.verifyPayment({
        sessionId: 'cs_test',
        paymentId: 'pi_processing',
      });

      expect(result.verified).toBe(false);
      expect(result.status).toBe('pending');
    });

    it('should throw ServiceUnavailableException on payment intent fetch failure', async () => {
      mockPaymentIntentsRetrieve.mockRejectedValue(new Error('API error'));

      await expect(
        provider.verifyPayment({
          sessionId: 'cs_test',
          paymentId: 'pi_error',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw ServiceUnavailableException on session retrieve failure', async () => {
      mockSessionsRetrieve.mockRejectedValue(new Error('Session not found'));

      await expect(
        provider.verifyPayment({
          sessionId: 'cs_not_found',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should retry on transient payment fetch failure', async () => {
      mockPaymentIntentsRetrieve
        .mockRejectedValueOnce(new Error('Network blip'))
        .mockResolvedValueOnce(mockPaymentIntent);

      const result = await provider.verifyPayment({
        sessionId: 'cs_test',
        paymentId: 'pi_test_intent_abc',
      });

      expect(mockPaymentIntentsRetrieve).toHaveBeenCalledTimes(2);
      expect(result.verified).toBe(true);
    });
  });

  describe('refund', () => {
    it('should process a full refund via Stripe', async () => {
      mockRefundsCreate.mockResolvedValue(mockRefund);

      const result = await provider.refund({
        paymentId: 'pi_test_intent_abc',
        amount: 2900,
        reason: 'Customer requested',
      });

      expect(mockRefundsCreate).toHaveBeenCalledWith(
        { payment_intent: 'pi_test_intent_abc', amount: 2900 },
        expect.objectContaining({ idempotencyKey: expect.any(String) }),
      );
      expect(result.refundId).toBe('re_test_refund_abc');
      expect(result.status).toBe('succeeded');
      expect(result.provider).toBe('stripe');
    });

    it('should process a partial refund', async () => {
      mockRefundsCreate.mockResolvedValue({ ...mockRefund, amount: 1000 });

      const result = await provider.refund({ paymentId: 'pi_test', amount: 1000 });

      expect(mockRefundsCreate).toHaveBeenCalledWith(
        { payment_intent: 'pi_test', amount: 1000 },
        expect.any(Object),
      );
      expect(result.amount).toBe(1000);
    });

    it('should include metadata in refund when provided', async () => {
      mockRefundsCreate.mockResolvedValue(mockRefund);

      await provider.refund({
        paymentId: 'pi_test',
        metadata: { reason: 'duplicate' },
      });

      expect(mockRefundsCreate).toHaveBeenCalledWith(
        { payment_intent: 'pi_test', metadata: { reason: 'duplicate' } },
        expect.any(Object),
      );
    });

    it('should use same idempotency key for identical refund params', async () => {
      mockRefundsCreate.mockResolvedValue(mockRefund);

      const params = { paymentId: 'pi_test', amount: 500, reason: 'partial' };

      await provider.refund(params);
      const firstKey = mockRefundsCreate.mock.calls[0][1]?.idempotencyKey;

      mockRefundsCreate.mockClear();
      await provider.refund(params);
      const secondKey = mockRefundsCreate.mock.calls[0][1]?.idempotencyKey;

      expect(firstKey).toBe(secondKey);
    });

    it('should use different idempotency key for different refund amounts', async () => {
      mockRefundsCreate.mockResolvedValue(mockRefund);

      await provider.refund({ paymentId: 'pi_test', amount: 500 });
      const firstKey = mockRefundsCreate.mock.calls[0][1]?.idempotencyKey;

      mockRefundsCreate.mockClear();
      await provider.refund({ paymentId: 'pi_test', amount: 1000 });
      const secondKey = mockRefundsCreate.mock.calls[0][1]?.idempotencyKey;

      expect(firstKey).not.toBe(secondKey);
    });

    it('should throw ServiceUnavailableException on refund API failure', async () => {
      mockRefundsCreate.mockRejectedValue(new Error('Refund API error'));

      await expect(provider.refund({ paymentId: 'pi_test' })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should retry on transient refund failure', async () => {
      mockRefundsCreate
        .mockRejectedValueOnce(new Error('Network issue'))
        .mockResolvedValueOnce(mockRefund);

      const result = await provider.refund({ paymentId: 'pi_test', amount: 500 });

      expect(mockRefundsCreate).toHaveBeenCalledTimes(2);
      expect(result.refundId).toBe('re_test_refund_abc');
    });
  });

  describe('handleWebhook', () => {
    const mockStripeEvent = {
      id: 'evt_12345',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test' } },
      created: Date.now(),
    };

    it('should verify valid webhook signature via constructEvent', async () => {
      mockConstructEvent.mockReturnValue(mockStripeEvent);

      const result = await provider.handleWebhook({
        rawBody: JSON.stringify({ type: 'payment_intent.succeeded' }),
        headers: { 'stripe-signature': 'valid_sig' },
        signature: 'valid_sig',
      });

      expect(mockConstructEvent).toHaveBeenCalled();
      expect(result.processed).toBe(true);
      expect(result.event).toBe('payment_intent.succeeded');
    });

    it('should reject invalid webhook signature', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const result = await provider.handleWebhook({
        rawBody: JSON.stringify({ type: 'payment_intent.succeeded' }),
        headers: { 'stripe-signature': 'bad_sig' },
        signature: 'bad_sig',
      });

      expect(result.processed).toBe(false);
      expect(result.event).toBe('verification_failed');
    });

    it('should return verification_failed when signature header is missing', async () => {
      const result = await provider.handleWebhook({
        rawBody: JSON.stringify({ type: 'payment_intent.succeeded' }),
        headers: {},
      });

      expect(result.processed).toBe(false);
      expect(result.event).toBe('verification_failed');
    });

    it('should accept webhook when no secret configured', async () => {
      configService.get.mockImplementation((key: string) => {
        const map: Record<string, string> = {
          'stripe.secretKey': 'sk_test_key',
          'stripe.webhookSecret': '',
          'stripe.publishableKey': 'pk_test_key',
        };
        return map[key] ?? undefined;
      });

      const noSecretProvider = new StripeProvider(configService);

      const result = await noSecretProvider.handleWebhook({
        rawBody: { type: 'payment_intent.succeeded' },
        headers: {},
      });

      expect(result.processed).toBe(true);
      expect(result.event).toBe('payment_intent.succeeded');
    });

    it('should skip duplicate webhook events', async () => {
      mockConstructEvent.mockReturnValue(mockStripeEvent);

      const rawBody = JSON.stringify({ type: 'payment_intent.succeeded' });

      const first = await provider.handleWebhook({
        rawBody,
        headers: { 'stripe-signature': 'sig' },
        signature: 'sig',
      });
      expect(first.processed).toBe(true);

      const second = await provider.handleWebhook({
        rawBody,
        headers: { 'stripe-signature': 'sig' },
        signature: 'sig',
      });
      expect(second.processed).toBe(true);
      expect(second.data.duplicate_skipped).toBe(true);
    });

    it('should extract event id in response data', async () => {
      mockConstructEvent.mockReturnValue(mockStripeEvent);

      const result = await provider.handleWebhook({
        rawBody: JSON.stringify({ type: 'payment_intent.succeeded' }),
        headers: { 'stripe-signature': 'sig' },
        signature: 'sig',
      });

      expect(result.data.event_id).toBe('evt_12345');
    });
  });

  describe('configuration', () => {
    it('should handle missing credentials gracefully', () => {
      configService.get.mockReturnValue(undefined);
      const unconfiguredProvider = new StripeProvider(configService);

      expect(unconfiguredProvider['stripe']).toBeNull();
    });

    it('should throw ServiceUnavailableException when not configured', () => {
      configService.get.mockReturnValue(undefined);
      const unconfiguredProvider = new StripeProvider(configService);

      expect(() => unconfiguredProvider['ensureInitialized']()).toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
