import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from '../billing.service';
import { PaymentService } from '../payment.service';
import { InvoiceService } from '../invoice.service';
import { CouponService } from '../coupon.service';
import { PaymentGatewayService } from '../providers/payment-gateway.service';

describe('BillingService', () => {
  let service: BillingService;
  let paymentService: jest.Mocked<Pick<PaymentService, keyof PaymentService>>;
  let invoiceService: jest.Mocked<Pick<InvoiceService, keyof InvoiceService>>;
  let couponService: jest.Mocked<Pick<CouponService, keyof CouponService>>;
  let gatewayService: jest.Mocked<Pick<PaymentGatewayService, keyof PaymentGatewayService>>;

  beforeEach(async () => {
    paymentService = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findByOrganization: jest.fn(),
      findByProviderPaymentId: jest.fn(),
      markSucceeded: jest.fn(),
      markFailed: jest.fn(),
      refund: jest.fn(),
    } as unknown as jest.Mocked<Pick<PaymentService, keyof PaymentService>>;

    invoiceService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByNumber: jest.fn(),
      findAll: jest.fn(),
      markPaid: jest.fn(),
      issue: jest.fn(),
      cancel: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<Pick<InvoiceService, keyof InvoiceService>>;

    couponService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      validate: jest.fn(),
      apply: jest.fn(),
      recordUsage: jest.fn(),
    } as unknown as jest.Mocked<Pick<CouponService, keyof CouponService>>;

    gatewayService = {
      registerProvider: jest.fn(),
      getProvider: jest.fn(),
      getRegisteredProviders: jest.fn(),
      createCheckout: jest.fn(),
      verifyPayment: jest.fn(),
      createSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      refundPayment: jest.fn(),
      handleWebhook: jest.fn(),
    } as unknown as jest.Mocked<Pick<PaymentGatewayService, keyof PaymentGatewayService>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PaymentService, useValue: paymentService },
        { provide: InvoiceService, useValue: invoiceService },
        { provide: CouponService, useValue: couponService },
        { provide: PaymentGatewayService, useValue: gatewayService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined and expose domain services', () => {
    expect(service).toBeDefined();
    expect(service.payments).toBeDefined();
    expect(service.invoices).toBeDefined();
    expect(service.coupons).toBeDefined();
    expect(service.gateway).toBeDefined();
  });

  it('should delegate to PaymentService through payments property', () => {
    expect(service.payments).toBe(paymentService);
  });

  it('should delegate to InvoiceService through invoices property', () => {
    expect(service.invoices).toBe(invoiceService);
  });

  it('should delegate to CouponService through coupons property', () => {
    expect(service.coupons).toBe(couponService);
  });

  it('should delegate to PaymentGatewayService through gateway property', () => {
    expect(service.gateway).toBe(gatewayService);
  });
});
