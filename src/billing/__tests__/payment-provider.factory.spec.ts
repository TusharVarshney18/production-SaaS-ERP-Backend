import { NotImplementedException } from '@nestjs/common';
import { PaymentProviderFactory } from '../providers/payment-provider.factory';
import { PaymentGateway } from '../providers/payment-gateway.interface';

describe('PaymentProviderFactory', () => {
  let factory: PaymentProviderFactory;

  const mockGateway: PaymentGateway = {
    name: 'test_gateway',
    createCheckout: jest.fn(),
    verifyPayment: jest.fn(),
    refund: jest.fn(),
    handleWebhook: jest.fn(),
  };

  beforeEach(() => {
    factory = new PaymentProviderFactory();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a provider', () => {
      factory.register('test', mockGateway);

      expect(factory.hasProvider('test')).toBe(true);
      expect(factory.getRegisteredProviders()).toContain('test');
    });

    it('should warn and overwrite when registering duplicate', () => {
      const warnSpy = jest.spyOn(factory['logger'], 'warn').mockImplementation(() => {});

      factory.register('test', mockGateway);
      factory.register('test', mockGateway);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
      warnSpy.mockRestore();
    });
  });

  describe('getProvider', () => {
    it('should return a registered provider', () => {
      factory.register('test', mockGateway);

      const provider = factory.getProvider('test');

      expect(provider).toBe(mockGateway);
    });

    it('should throw NotImplementedException for unregistered provider', () => {
      expect(() => factory.getProvider('nonexistent')).toThrow(NotImplementedException);
    });

    it('should list available providers in error message', () => {
      factory.register('alpha', mockGateway);

      expect(() => factory.getProvider('unknown')).toThrow(/alpha/);
    });
  });

  describe('getRegisteredProviders', () => {
    it('should return empty array initially', () => {
      expect(factory.getRegisteredProviders()).toEqual([]);
    });

    it('should return list of registered provider names', () => {
      factory.register('razorpay', mockGateway);
      factory.register('stripe', { ...mockGateway, name: 'stripe' });

      const providers = factory.getRegisteredProviders();
      expect(providers).toEqual(['razorpay', 'stripe']);
    });
  });

  describe('hasProvider', () => {
    it('should return true for registered provider', () => {
      factory.register('test', mockGateway);

      expect(factory.hasProvider('test')).toBe(true);
    });

    it('should return false for unregistered provider', () => {
      expect(factory.hasProvider('unknown')).toBe(false);
    });
  });
});
