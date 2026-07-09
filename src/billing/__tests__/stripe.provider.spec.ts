import { StripeProvider } from '../providers/stripe/stripe.provider';

describe('StripeProvider', () => {
  let provider: StripeProvider;

  beforeEach(() => {
    provider = new StripeProvider();
  });

  describe('name', () => {
    it('should be stripe', () => {
      expect(provider.name).toBe('stripe');
    });
  });

  describe('createCheckout', () => {
    it('should return a mock checkout response', async () => {
      const result = await provider.createCheckout({
        amount: 2900,
        currency: 'USD',
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.provider).toBe('stripe');
      expect(result.checkoutUrl).toContain('checkout.stripe.com');
      expect(result.sessionId).toContain('cs_');
    });
  });

  describe('verifyPayment', () => {
    it('should return a mock verification response', async () => {
      const result = await provider.verifyPayment({
        sessionId: 'cs_test',
      });

      expect(result.verified).toBe(true);
      expect(result.provider).toBe('stripe');
      expect(result.status).toBe('paid');
      expect(result.currency).toBe('USD');
    });
  });

  describe('refund', () => {
    it('should return a mock refund response', async () => {
      const result = await provider.refund({
        paymentId: 'pi_test',
        reason: 'Duplicate charge',
      });

      expect(result.provider).toBe('stripe');
      expect(result.refundId).toContain('re_');
      expect(result.status).toBe('succeeded');
    });
  });

  describe('handleWebhook', () => {
    it('should extract event type from payload', async () => {
      const result = await provider.handleWebhook({
        rawBody: { type: 'payment_intent.succeeded', data: { object: {} } },
        headers: { 'stripe-signature': 'sig_abc' },
      });

      expect(result.processed).toBe(true);
      expect(result.event).toBe('payment_intent.succeeded');
    });
  });
});
