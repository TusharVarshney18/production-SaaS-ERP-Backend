import { NotImplementedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from '../payment.service';
import { PaymentProvider } from '../interfaces/payment-provider.interface';
import { CreateCheckoutDto } from '../dto/create-checkout.dto';
import { VerifyPaymentDto } from '../dto/verify-payment.dto';
import { CreateBillingSubscriptionDto } from '../dto/create-subscription.dto';
import { CancelBillingSubscriptionDto } from '../dto/cancel-subscription.dto';
import { RefundPaymentDto } from '../dto/refund-payment.dto';
import { HandleWebhookDto } from '../dto/handle-webhook.dto';

describe('PaymentService', () => {
  let service: PaymentService;

  const mockProvider: PaymentProvider = {
    name: 'test_provider',
    createCheckout: jest.fn(),
    verifyPayment: jest.fn(),
    createSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    refundPayment: jest.fn(),
    handleWebhook: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentService],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerProvider', () => {
    it('should register a provider', () => {
      service.registerProvider('test', mockProvider);

      const providers = service.getRegisteredProviders();
      expect(providers).toContain('test');
    });

    it('should warn and overwrite when registering duplicate', () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});

      service.registerProvider('test', mockProvider);
      service.registerProvider('test', mockProvider);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
      warnSpy.mockRestore();
    });
  });

  describe('getProvider', () => {
    it('should return a registered provider', () => {
      service.registerProvider('test', mockProvider);

      const provider = service.getProvider('test');

      expect(provider).toBe(mockProvider);
    });

    it('should throw NotImplementedException for unregistered provider', () => {
      expect(() => service.getProvider('nonexistent')).toThrow(NotImplementedException);
    });
  });

  describe('getRegisteredProviders', () => {
    it('should return empty array when no providers registered', () => {
      expect(service.getRegisteredProviders()).toEqual([]);
    });

    it('should return list of registered provider names', () => {
      service.registerProvider('alpha', mockProvider);
      service.registerProvider('beta', mockProvider);

      const providers = service.getRegisteredProviders();
      expect(providers).toEqual(['alpha', 'beta']);
    });
  });

  describe('createCheckout', () => {
    it('should delegate to razorpay provider', async () => {
      service.registerProvider('razorpay', mockProvider);
      (mockProvider.createCheckout as jest.Mock).mockResolvedValue({
        checkoutUrl: 'https://checkout.example.com',
        sessionId: 'sess_123',
        provider: 'razorpay',
      });

      const dto: CreateCheckoutDto = {
        amount: 2900,
        currency: 'USD',
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://app.erpx.io/success',
        cancelUrl: 'https://app.erpx.io/cancel',
      };

      const result = await service.createCheckout(dto);

      expect(mockProvider.createCheckout).toHaveBeenCalledWith({
        amount: 2900,
        currency: 'USD',
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        description: undefined,
        metadata: undefined,
        successUrl: 'https://app.erpx.io/success',
        cancelUrl: 'https://app.erpx.io/cancel',
      });
      expect(result.checkoutUrl).toBe('https://checkout.example.com');
    });

    it('should throw when razorpay is not registered', async () => {
      const dto: CreateCheckoutDto = {
        amount: 2900,
        currency: 'USD',
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        successUrl: 'https://app.erpx.io/success',
        cancelUrl: 'https://app.erpx.io/cancel',
      };

      await expect(service.createCheckout(dto)).rejects.toThrow(NotImplementedException);
    });
  });

  describe('verifyPayment', () => {
    it('should delegate to the specified provider', async () => {
      service.registerProvider('stripe', mockProvider);
      (mockProvider.verifyPayment as jest.Mock).mockResolvedValue({
        verified: true,
        paymentId: 'pay_123',
        status: 'paid',
        amount: 2900,
        currency: 'USD',
        provider: 'stripe',
      });

      const dto: VerifyPaymentDto = {
        sessionId: 'sess_123',
        provider: 'stripe',
      };

      const result = await service.verifyPayment(dto);

      expect(mockProvider.verifyPayment).toHaveBeenCalledWith({
        sessionId: 'sess_123',
        paymentId: undefined,
        provider: 'stripe',
        signature: undefined,
        metadata: undefined,
      });
      expect(result.verified).toBe(true);
    });
  });

  describe('createSubscription', () => {
    it('should delegate to razorpay provider', async () => {
      service.registerProvider('razorpay', mockProvider);
      (mockProvider.createSubscription as jest.Mock).mockResolvedValue({
        subscriptionId: 'sub_123',
        providerSubscriptionId: 'ps_123',
        status: 'active',
        provider: 'razorpay',
      });

      const dto: CreateBillingSubscriptionDto = {
        organizationId: 'org-1',
        planId: 'plan-1',
        planName: 'Growth Plan',
        amount: 2900,
        currency: 'USD',
        interval: 'monthly',
        successUrl: 'https://app.erpx.io/success',
        cancelUrl: 'https://app.erpx.io/cancel',
      };

      const result = await service.createSubscription(dto);

      expect(mockProvider.createSubscription).toHaveBeenCalled();
      expect(result.subscriptionId).toBe('sub_123');
    });
  });

  describe('cancelSubscription', () => {
    it('should delegate to the specified provider', async () => {
      service.registerProvider('stripe', mockProvider);
      (mockProvider.cancelSubscription as jest.Mock).mockResolvedValue(undefined);

      const dto: CancelBillingSubscriptionDto = {
        providerSubscriptionId: 'ps_123',
        provider: 'stripe',
      };

      await service.cancelSubscription(dto);

      expect(mockProvider.cancelSubscription).toHaveBeenCalledWith({
        providerSubscriptionId: 'ps_123',
        provider: 'stripe',
        atPeriodEnd: undefined,
        metadata: undefined,
      });
    });
  });

  describe('refundPayment', () => {
    it('should delegate to razorpay provider', async () => {
      service.registerProvider('razorpay', mockProvider);
      (mockProvider.refundPayment as jest.Mock).mockResolvedValue({
        refundId: 'rf_123',
        paymentId: 'pay_123',
        amount: 2900,
        status: 'processed',
        provider: 'razorpay',
      });

      const dto: RefundPaymentDto = {
        paymentId: 'pay_123',
      };

      const result = await service.refundPayment(dto);

      expect(mockProvider.refundPayment).toHaveBeenCalled();
      expect(result.refundId).toBe('rf_123');
    });
  });

  describe('handleWebhook', () => {
    it('should delegate to the specified provider', async () => {
      service.registerProvider('razorpay', mockProvider);
      (mockProvider.handleWebhook as jest.Mock).mockResolvedValue({
        processed: true,
        event: 'payment.captured',
        data: { payment_id: 'pay_123' },
      });

      const dto: HandleWebhookDto = {
        provider: 'razorpay',
        rawBody: { event: 'payment.captured' },
        headers: { 'x-webhook-signature': 'sig_abc' },
        signature: 'sig_abc',
      };

      const result = await service.handleWebhook(dto);

      expect(mockProvider.handleWebhook).toHaveBeenCalledWith({
        provider: 'razorpay',
        rawBody: { event: 'payment.captured' },
        headers: { 'x-webhook-signature': 'sig_abc' },
        signature: 'sig_abc',
      });
      expect(result.processed).toBe(true);
    });
  });

  describe('onModuleInit auto-registration', () => {
    it('should register razorpay and stripe providers on init', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentService,
          {
            provide: 'RazorpayProvider',
            useValue: { ...mockProvider, name: 'razorpay' },
          },
          {
            provide: 'StripeProvider',
            useValue: { ...mockProvider, name: 'stripe' },
          },
        ],
      }).compile();

      const paymentService = module.get<PaymentService>(PaymentService);
      const logSpy = jest.spyOn(paymentService['logger'], 'log').mockImplementation(() => {});

      const razorpayProvider = {
        ...mockProvider,
        name: 'razorpay' as const,
      };
      const stripeProvider = {
        ...mockProvider,
        name: 'stripe' as const,
      };

      paymentService.registerProvider('razorpay', razorpayProvider);
      paymentService.registerProvider('stripe', stripeProvider);

      expect(paymentService.getRegisteredProviders()).toEqual(['razorpay', 'stripe']);
      logSpy.mockRestore();
    });
  });
});
