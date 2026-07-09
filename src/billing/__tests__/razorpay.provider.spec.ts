import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { RazorpayProvider } from '../providers/razorpay/razorpay.provider';

const mockOrdersCreate = jest.fn();
const mockOrdersFetch = jest.fn();
const mockPaymentsFetch = jest.fn();
const mockPaymentsRefund = jest.fn();

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: { create: mockOrdersCreate, fetch: mockOrdersFetch },
    payments: { fetch: mockPaymentsFetch, refund: mockPaymentsRefund },
  }));
});

describe('RazorpayProvider', () => {
  let provider: RazorpayProvider;
  let configService: jest.Mocked<ConfigService>;

  const mockOrder = {
    id: 'order_Oa1b2c3d4e5f6g',
    entity: 'order',
    amount: 2900,
    amount_due: 2900,
    amount_paid: 0,
    currency: 'INR',
    receipt: 'rcpt_test123',
    status: 'created',
    attempts: 0,
    notes: {},
    created_at: Date.now(),
  };

  const mockPayment = {
    id: 'pay_Oa1b2c3d4e5f6g',
    entity: 'payment',
    amount: 2900,
    currency: 'INR',
    status: 'captured',
    order_id: 'order_Oa1b2c3d4e5f6g',
    invoice_id: null,
    method: 'upi',
    amount_refunded: 0,
    refund_status: null,
    captured: true,
    description: '',
    bank: null,
    card_id: null,
    email: 'test@example.com',
    contact: '+919000000000',
    notes: {},
    fee: 50,
    tax: 10,
    created_at: Date.now(),
  };

  const mockRefund = {
    id: 'rfnd_Oa1b2c3d4e5f6g',
    entity: 'refund',
    amount: 2900,
    currency: 'INR',
    payment_id: 'pay_Oa1b2c3d4e5f6g',
    status: 'processed',
    created_at: Date.now(),
  };

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    configService.get.mockImplementation((key: string) => {
      const map: Record<string, string> = {
        'razorpay.keyId': 'rzp_test_key',
        'razorpay.keySecret': 'rzp_test_secret',
        'razorpay.webhookSecret': 'whsec_test',
      };
      return map[key] ?? undefined;
    });

    provider = new RazorpayProvider(configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('name', () => {
    it('should be razorpay', () => {
      expect(provider.name).toBe('razorpay');
    });
  });

  describe('createCheckout', () => {
    it('should create a Razorpay order and return checkout response', async () => {
      mockOrdersCreate.mockResolvedValue(mockOrder);

      const result = await provider.createCheckout({
        amount: 2900,
        currency: 'INR',
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        metadata: { source: 'web' },
      });

      expect(mockOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2900,
          currency: 'INR',
          notes: expect.objectContaining({
            organization_id: 'org-1',
            subscription_id: 'sub-1',
            plan_id: 'plan-1',
            source: 'web',
          }),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Razorpay-Idempotency-Key': expect.any(String),
          }),
        }),
      );

      expect(result.provider).toBe('razorpay');
      expect(result.sessionId).toBe('order_Oa1b2c3d4e5f6g');
      expect(result.checkoutUrl).toContain('checkout.razorpay.com');
    });

    it('should pass same idempotency key for identical params', async () => {
      mockOrdersCreate.mockResolvedValue(mockOrder);

      const params = {
        amount: 1000,
        currency: 'INR' as const,
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      await provider.createCheckout(params);
      const firstCallHeaders = mockOrdersCreate.mock.calls[0][1]?.headers;

      mockOrdersCreate.mockClear();

      await provider.createCheckout(params);
      const secondCallHeaders = mockOrdersCreate.mock.calls[0][1]?.headers;

      expect(firstCallHeaders['X-Razorpay-Idempotency-Key']).toBe(
        secondCallHeaders['X-Razorpay-Idempotency-Key'],
      );
    });

    it('should use different idempotency key for different params', async () => {
      mockOrdersCreate.mockResolvedValue(mockOrder);

      await provider.createCheckout({
        amount: 1000,
        currency: 'INR' as const,
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });
      const firstKey = mockOrdersCreate.mock.calls[0][1]?.headers['X-Razorpay-Idempotency-Key'];

      mockOrdersCreate.mockClear();

      await provider.createCheckout({
        amount: 2000,
        currency: 'INR' as const,
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });
      const secondKey = mockOrdersCreate.mock.calls[0][1]?.headers['X-Razorpay-Idempotency-Key'];

      expect(firstKey).not.toBe(secondKey);
    });

    it('should throw if razorpay is not configured', async () => {
      configService.get.mockReturnValue(undefined);
      const unconfiguredProvider = new RazorpayProvider(configService);

      await expect(
        unconfiguredProvider.createCheckout({
          amount: 100,
          currency: 'INR',
          organizationId: 'org-1',
          subscriptionId: 'sub-1',
          planId: 'plan-1',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should retry on transient failure and succeed', async () => {
      mockOrdersCreate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockOrder);

      const result = await provider.createCheckout({
        amount: 2900,
        currency: 'INR',
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(mockOrdersCreate).toHaveBeenCalledTimes(2);
      expect(result.sessionId).toBe('order_Oa1b2c3d4e5f6g');
    });

    it('should throw ServiceUnavailableException after all retries exhausted', async () => {
      mockOrdersCreate.mockRejectedValue(new Error('API unavailable'));

      await expect(
        provider.createCheckout({
          amount: 100,
          currency: 'INR',
          organizationId: 'org-1',
          subscriptionId: 'sub-1',
          planId: 'plan-1',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(mockOrdersCreate.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('verifyPayment', () => {
    it('should verify payment with valid signature', async () => {
      mockPaymentsFetch.mockResolvedValue(mockPayment);

      const validSignature = createHmac('sha256', 'rzp_test_secret')
        .update('order_Oa1b2c3d4e5f6g|pay_Oa1b2c3d4e5f6g')
        .digest('hex');

      const result = await provider.verifyPayment({
        sessionId: 'order_Oa1b2c3d4e5f6g',
        paymentId: 'pay_Oa1b2c3d4e5f6g',
        signature: validSignature,
      });

      expect(result.verified).toBe(true);
      expect(result.paymentId).toBe('pay_Oa1b2c3d4e5f6g');
      expect(result.status).toBe('paid');
    });

    it('should return failed verification for invalid signature', async () => {
      const result = await provider.verifyPayment({
        sessionId: 'order_test',
        paymentId: 'pay_test',
        signature: 'invalid_signature',
      });

      expect(result.verified).toBe(false);
      expect(result.status).toBe('failed');
    });

    it('should fetch payment details when no signature provided', async () => {
      mockPaymentsFetch.mockResolvedValue(mockPayment);

      const result = await provider.verifyPayment({
        sessionId: 'order_test',
        paymentId: 'pay_Oa1b2c3d4e5f6g',
      });

      expect(mockPaymentsFetch).toHaveBeenCalledWith('pay_Oa1b2c3d4e5f6g');
      expect(result.verified).toBe(true);
      expect(result.amount).toBe(2900);
      expect(result.currency).toBe('INR');
    });

    it('should handle failed payment status', async () => {
      mockPaymentsFetch.mockResolvedValue({ ...mockPayment, status: 'failed' });

      const result = await provider.verifyPayment({
        sessionId: 'order_test',
        paymentId: 'pay_Oa1b2c3d4e5f6g',
      });

      expect(result.verified).toBe(false);
      expect(result.status).toBe('failed');
    });

    it('should throw ServiceUnavailableException on payment fetch failure', async () => {
      mockPaymentsFetch.mockRejectedValue(new Error('API error'));

      await expect(
        provider.verifyPayment({
          sessionId: 'order_test',
          paymentId: 'pay_Oa1b2c3d4e5f6g',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should return verified=false when paymentId is missing', async () => {
      const result = await provider.verifyPayment({
        sessionId: 'order_test',
      });

      expect(result.verified).toBe(false);
      expect(result.status).toBe('failed');
    });

    it('should map captured status to paid', async () => {
      mockPaymentsFetch.mockResolvedValue({ ...mockPayment, status: 'captured' });
      const result = await provider.verifyPayment({
        sessionId: 'order_test',
        paymentId: 'pay_captured',
      });
      expect(result.status).toBe('paid');
      expect(result.verified).toBe(true);
    });

    it('should map failed status to failed', async () => {
      mockPaymentsFetch.mockResolvedValue({ ...mockPayment, status: 'failed' });
      const result = await provider.verifyPayment({
        sessionId: 'order_test',
        paymentId: 'pay_failed',
      });
      expect(result.status).toBe('failed');
      expect(result.verified).toBe(false);
    });

    it('should map refunded status to refunded', async () => {
      mockPaymentsFetch.mockResolvedValue({ ...mockPayment, status: 'refunded' });
      const result = await provider.verifyPayment({
        sessionId: 'order_test',
        paymentId: 'pay_refunded',
      });
      expect(result.status).toBe('refunded');
      expect(result.verified).toBe(false);
    });

    it('should map authorized status to pending', async () => {
      mockPaymentsFetch.mockResolvedValue({ ...mockPayment, status: 'authorized' });
      const result = await provider.verifyPayment({
        sessionId: 'order_test',
        paymentId: 'pay_authorized',
      });
      expect(result.status).toBe('pending');
      expect(result.verified).toBe(false);
    });

    it('should map unknown status to failed', async () => {
      mockPaymentsFetch.mockResolvedValue({ ...mockPayment, status: 'unknown_status' });
      const result = await provider.verifyPayment({
        sessionId: 'order_test',
        paymentId: 'pay_unknown',
      });
      expect(result.status).toBe('failed');
      expect(result.verified).toBe(false);
    });

    it('should retry on transient fetch failure', async () => {
      mockPaymentsFetch
        .mockRejectedValueOnce(new Error('Network blip'))
        .mockResolvedValueOnce(mockPayment);

      const result = await provider.verifyPayment({
        sessionId: 'order_test',
        paymentId: 'pay_Oa1b2c3d4e5f6g',
      });

      expect(mockPaymentsFetch).toHaveBeenCalledTimes(2);
      expect(result.verified).toBe(true);
    });
  });

  describe('refund', () => {
    it('should process a full refund via Razorpay', async () => {
      mockPaymentsRefund.mockResolvedValue(mockRefund);

      const result = await provider.refund({
        paymentId: 'pay_Oa1b2c3d4e5f6g',
        amount: 2900,
        reason: 'Customer requested',
      });

      expect(mockPaymentsRefund).toHaveBeenCalledWith('pay_Oa1b2c3d4e5f6g', { amount: 2900 });
      expect(result.refundId).toBe('rfnd_Oa1b2c3d4e5f6g');
      expect(result.status).toBe('processed');
      expect(result.provider).toBe('razorpay');
    });

    it('should process a partial refund', async () => {
      mockPaymentsRefund.mockResolvedValue({ ...mockRefund, amount: 1000 });

      const result = await provider.refund({ paymentId: 'pay_test', amount: 1000 });

      expect(mockPaymentsRefund).toHaveBeenCalledWith('pay_test', { amount: 1000 });
      expect(result.amount).toBe(1000);
    });

    it('should include notes in refund when metadata provided', async () => {
      mockPaymentsRefund.mockResolvedValue(mockRefund);

      await provider.refund({
        paymentId: 'pay_test',
        metadata: { reason: 'duplicate' },
      });

      expect(mockPaymentsRefund).toHaveBeenCalledWith('pay_test', {
        notes: { reason: 'duplicate' },
      });
    });

    it('should throw ServiceUnavailableException on refund API failure', async () => {
      mockPaymentsRefund.mockRejectedValue(new Error('Refund API error'));

      await expect(provider.refund({ paymentId: 'pay_test' })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should retry on transient refund failure', async () => {
      mockPaymentsRefund
        .mockRejectedValueOnce(new Error('Network issue'))
        .mockResolvedValueOnce(mockRefund);

      const result = await provider.refund({ paymentId: 'pay_test', amount: 500 });

      expect(mockPaymentsRefund).toHaveBeenCalledTimes(2);
      expect(result.refundId).toBe('rfnd_Oa1b2c3d4e5f6g');
    });
  });

  describe('handleWebhook', () => {
    it('should verify valid webhook signature', async () => {
      const rawBody = JSON.stringify({ event: 'payment.captured', payload: {} });
      const validSignature = createHmac('sha256', 'whsec_test').update(rawBody).digest('hex');

      const result = await provider.handleWebhook({
        rawBody,
        headers: { 'x-razorpay-signature': validSignature },
        signature: validSignature,
      });

      expect(result.processed).toBe(true);
      expect(result.event).toBe('payment.captured');
    });

    it('should reject invalid webhook signature', async () => {
      const result = await provider.handleWebhook({
        rawBody: JSON.stringify({ event: 'payment.captured' }),
        headers: { 'x-razorpay-signature': 'bad_sig' },
        signature: 'bad_sig',
      });

      expect(result.processed).toBe(false);
      expect(result.event).toBe('verification_failed');
    });

    it('should accept webhook when no secret configured', async () => {
      configService.get.mockImplementation((key: string) => {
        const map: Record<string, string> = {
          'razorpay.keyId': 'rzp_test_key',
          'razorpay.keySecret': 'rzp_test_secret',
          'razorpay.webhookSecret': '',
        };
        return map[key] ?? undefined;
      });

      const noSecretProvider = new RazorpayProvider(configService);

      const result = await noSecretProvider.handleWebhook({
        rawBody: { event: 'payment.captured' },
        headers: {},
      });

      expect(result.processed).toBe(true);
      expect(result.event).toBe('payment.captured');
    });

    it('should parse object rawBody as JSON string for signature', async () => {
      const rawBody = { event: 'payment.captured', payload: {} };
      const rawString = JSON.stringify(rawBody);
      const validSignature = createHmac('sha256', 'whsec_test').update(rawString).digest('hex');

      const result = await provider.handleWebhook({
        rawBody,
        headers: { 'x-razorpay-signature': validSignature },
        signature: validSignature,
      });

      expect(result.processed).toBe(true);
    });

    it('should reject malformed JSON body', async () => {
      const result = await provider.handleWebhook({
        rawBody: '{invalid json}',
        headers: {},
      });

      expect(result.processed).toBe(false);
      expect(result.event).toBe('parse_failed');
    });

    it('should handle null body gracefully', async () => {
      const result = await provider.handleWebhook({
        rawBody: null,
        headers: {},
      });

      expect(result.processed).toBe(false);
      expect(result.event).toBe('empty_body');
    });

    it('should skip duplicate webhook events', async () => {
      const eventPayload = {
        id: 'evt_12345',
        event: 'payment.captured',
        payload: {},
      };
      const rawBody = JSON.stringify(eventPayload);
      const validSignature = createHmac('sha256', 'whsec_test').update(rawBody).digest('hex');

      const first = await provider.handleWebhook({
        rawBody,
        headers: { 'x-razorpay-signature': validSignature },
        signature: validSignature,
      });
      expect(first.processed).toBe(true);
      expect(first.event).toBe('payment.captured');

      const second = await provider.handleWebhook({
        rawBody,
        headers: { 'x-razorpay-signature': validSignature },
        signature: validSignature,
      });
      expect(second.processed).toBe(true);
      expect(second.data.duplicate_skipped).toBe(true);
    });

    it('should still process webhook without event id', async () => {
      const rawBody = JSON.stringify({ event: 'payment.captured' });
      const validSignature = createHmac('sha256', 'whsec_test').update(rawBody).digest('hex');

      const result = await provider.handleWebhook({
        rawBody,
        headers: { 'x-razorpay-signature': validSignature },
        signature: validSignature,
      });

      expect(result.processed).toBe(true);
      expect(result.event).toBe('payment.captured');
    });

    it('should extract event id in response data', async () => {
      const rawBody = JSON.stringify({ id: 'evt_999', event: 'payment.failed' });
      const validSignature = createHmac('sha256', 'whsec_test').update(rawBody).digest('hex');

      const result = await provider.handleWebhook({
        rawBody,
        headers: {},
        signature: validSignature,
      });

      expect(result.data.event_id).toBe('evt_999');
    });
  });

  describe('configuration', () => {
    it('should handle missing credentials gracefully', () => {
      configService.get.mockReturnValue(undefined);
      const unconfiguredProvider = new RazorpayProvider(configService);

      expect(unconfiguredProvider['razorpay']).toBeNull();
    });

    it('should throw ServiceUnavailableException when not configured', () => {
      configService.get.mockReturnValue(undefined);
      const unconfiguredProvider = new RazorpayProvider(configService);

      expect(() => unconfiguredProvider['ensureInitialized']()).toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
