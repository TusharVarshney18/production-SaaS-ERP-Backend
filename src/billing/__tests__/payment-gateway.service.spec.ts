import { NotImplementedException } from '@nestjs/common';
import { mockDeep } from 'jest-mock-extended';
import { PaymentGatewayService } from '../services/payment-gateway.service';
import { PaymentProviderFactory } from '../providers/payment-provider.factory';
import { PaymentGateway } from '../providers/payment-gateway.interface';

describe('PaymentGatewayService', () => {
  let service: PaymentGatewayService;
  let factory: jest.Mocked<PaymentProviderFactory>;
  let mockProvider: PaymentGateway;

  beforeEach(async () => {
    factory = mockDeep<PaymentProviderFactory>();
    service = new PaymentGatewayService(factory);

    mockProvider = {
      name: 'razorpay',
      createCheckout: jest.fn(),
      verifyPayment: jest.fn(),
      refund: jest.fn(),
      handleWebhook: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailableProviders', () => {
    it('should delegate to factory', () => {
      factory.getRegisteredProviders.mockReturnValue(['razorpay', 'stripe']);

      const result = service.getAvailableProviders();

      expect(result).toEqual(['razorpay', 'stripe']);
    });
  });

  describe('createCheckout', () => {
    it('should delegate to the specified provider', async () => {
      factory.getProvider.mockReturnValue(mockProvider);
      (mockProvider.createCheckout as jest.Mock).mockResolvedValue({
        checkoutUrl: 'https://checkout.razorpay.com/test',
        sessionId: 'sess_test',
        provider: 'razorpay',
      });

      const result = await service.createCheckout({
        provider: 'razorpay',
        amount: 2900,
        currency: 'USD',
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://app.erpx.io/success',
        cancelUrl: 'https://app.erpx.io/cancel',
      });

      expect(factory.getProvider).toHaveBeenCalledWith('razorpay');
      expect(mockProvider.createCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 2900, currency: 'USD' }),
      );
      expect(result.checkoutUrl).toBe('https://checkout.razorpay.com/test');
    });

    it('should propagate factory errors for unknown provider', async () => {
      factory.getProvider.mockImplementation(() => {
        throw new NotImplementedException('not found');
      });

      await expect(
        service.createCheckout({
          provider: 'unknown',
          amount: 100,
          currency: 'USD',
          organizationId: 'org-1',
          subscriptionId: 'sub-1',
          planId: 'plan-1',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      ).rejects.toThrow(NotImplementedException);
    });
  });

  describe('verifyPayment', () => {
    it('should delegate to the specified provider', async () => {
      factory.getProvider.mockReturnValue(mockProvider);
      (mockProvider.verifyPayment as jest.Mock).mockResolvedValue({
        verified: true,
        paymentId: 'pay_test',
        status: 'paid',
        amount: 2900,
        currency: 'USD',
        provider: 'razorpay',
      });

      const result = await service.verifyPayment({
        provider: 'razorpay',
        sessionId: 'sess_test',
      });

      expect(factory.getProvider).toHaveBeenCalledWith('razorpay');
      expect(result.verified).toBe(true);
    });
  });

  describe('refund', () => {
    it('should delegate to the specified provider', async () => {
      factory.getProvider.mockReturnValue(mockProvider);
      (mockProvider.refund as jest.Mock).mockResolvedValue({
        refundId: 'rf_test',
        paymentId: 'pay_test',
        amount: 2900,
        status: 'processed',
        provider: 'razorpay',
      });

      const result = await service.refund({
        provider: 'razorpay',
        paymentId: 'pay_test',
        reason: 'Customer request',
      });

      expect(factory.getProvider).toHaveBeenCalledWith('razorpay');
      expect(result.refundId).toBe('rf_test');
    });
  });

  describe('handleWebhook', () => {
    it('should delegate to the specified provider', async () => {
      factory.getProvider.mockReturnValue(mockProvider);
      (mockProvider.handleWebhook as jest.Mock).mockResolvedValue({
        processed: true,
        event: 'payment.captured',
        data: { id: 'pay_test' },
      });

      const result = await service.handleWebhook({
        provider: 'razorpay',
        rawBody: { event: 'payment.captured' },
        headers: { 'x-signature': 'sig_abc' },
      });

      expect(factory.getProvider).toHaveBeenCalledWith('razorpay');
      expect(result.processed).toBe(true);
    });
  });

  describe('no hardcoded provider names', () => {
    it('should accept any registered provider name', async () => {
      const customProvider: PaymentGateway = {
        name: 'custom_pay',
        createCheckout: jest.fn().mockResolvedValue({
          checkoutUrl: 'https://custom.example.com/checkout',
          sessionId: 'custom_sess',
          provider: 'custom_pay',
        }),
        verifyPayment: jest.fn(),
        refund: jest.fn(),
        handleWebhook: jest.fn(),
      };

      factory.getProvider.mockReturnValue(customProvider);

      const result = await service.createCheckout({
        provider: 'custom_pay',
        amount: 5000,
        currency: 'INR',
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.provider).toBe('custom_pay');
      expect(factory.getProvider).toHaveBeenCalledWith('custom_pay');
    });
  });
});
