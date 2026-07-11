import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { BillingPortalService } from '../billing-portal.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentService } from '../../billing/payment.service';
import { InvoiceService } from '../../billing/invoice.service';
import { CouponService } from '../../billing/coupon.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { SubscriptionService } from '../../subscriptions/subscription.service';
import { PlanResolver } from '../../subscriptions/plan-resolver.service';
import { FeatureResolver } from '../../subscriptions/feature-resolver.service';
import { UsageResolver } from '../../subscriptions/usage-resolver.service';
import { OrganizationsService } from '../../organizations/organizations.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

describe('BillingPortalService', () => {
  let service: BillingPortalService;
  let prisma: DeepMockProxy<PrismaService>;
  let payments: DeepMockProxy<PaymentService>;
  let invoices: DeepMockProxy<InvoiceService>;
  let coupons: DeepMockProxy<CouponService>;
  let subscriptionsService: DeepMockProxy<SubscriptionsService>;
  let subscriptionService: DeepMockProxy<SubscriptionService>;
  let planResolver: DeepMockProxy<PlanResolver>;
  let features: DeepMockProxy<FeatureResolver>;
  let usage: DeepMockProxy<UsageResolver>;
  let organizations: DeepMockProxy<OrganizationsService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    payments = mockDeep<PaymentService>();
    invoices = mockDeep<InvoiceService>();
    coupons = mockDeep<CouponService>();
    subscriptionsService = mockDeep<SubscriptionsService>();
    subscriptionService = mockDeep<SubscriptionService>();
    planResolver = mockDeep<PlanResolver>();
    features = mockDeep<FeatureResolver>();
    usage = mockDeep<UsageResolver>();
    organizations = mockDeep<OrganizationsService>();
    auditLog = mockDeep<AuditLogService>();

    service = new BillingPortalService(
      prisma,
      payments,
      invoices,
      coupons,
      subscriptionsService,
      subscriptionService,
      planResolver,
      features,
      usage,
      organizations,
      auditLog,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentSubscription', () => {
    it('should return enriched subscription', async () => {
      const mockSubscription = { id: 'sub-1', planId: 'plan-1', status: 'ACTIVE' };
      const mockOrg = { id: 'org-1', trialEndsAt: null, plan: 'PRO' };
      (subscriptionsService.getSubscription as jest.Mock).mockResolvedValue(mockSubscription);
      (organizations.findById as jest.Mock).mockResolvedValue(mockOrg);

      const result = await service.getCurrentSubscription('org-1');
      expect(result).toMatchObject({
        ...mockSubscription,
        trialEndsAt: null,
        organizationPlan: 'PRO',
      });
    });
  });

  describe('comparePlans', () => {
    it('should return plans with features', async () => {
      const mockPlan = {
        id: 'plan-1',
        name: 'Pro',
        slug: 'pro',
        description: null,
        billingInterval: 'MONTHLY',
        price: 2900,
        currency: 'USD',
        trialPeriodDays: 14,
        features: [
          {
            feature: { slug: 'api', name: 'API Access', group: 'integrations' },
            value: '1000',
            isAvailable: true,
          },
        ],
      };
      (prisma.subscriptionPlan.findMany as jest.Mock).mockResolvedValue([mockPlan]);

      const result = await service.comparePlans();
      expect(result).toHaveLength(1);
      expect(result[0].features).toHaveLength(1);
      expect(result[0].features[0]).toMatchObject({
        slug: 'api',
        group: 'integrations',
        value: '1000',
      });
    });
  });

  describe('upgradePlan', () => {
    it('should change plan and audit log', async () => {
      const mockResult = { id: 'sub-1', planId: 'plan-2' };
      (subscriptionsService.changePlan as jest.Mock).mockResolvedValue(mockResult);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.upgradePlan('org-1', { planId: 'plan-2' }, 'user-1', 'req-1');

      expect(subscriptionsService.changePlan).toHaveBeenCalledWith('org-1', {
        planId: 'plan-2',
        immediate: undefined,
      });
      expect(auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          actorId: 'user-1',
          event: 'subscription.plan.upgraded',
          requestId: 'req-1',
        }),
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel and audit log', async () => {
      const mockResult = { id: 'sub-1', status: 'CANCELED' };
      (subscriptionsService.cancelSubscription as jest.Mock).mockResolvedValue(mockResult);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.cancelSubscription('org-1', 'user-1', 'req-1');

      expect(subscriptionsService.cancelSubscription).toHaveBeenCalledWith('org-1');
      expect(auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'subscription.canceled', severity: 'WARN' }),
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('resumeSubscription', () => {
    it('should renew and audit log', async () => {
      (subscriptionsService.renewSubscription as jest.Mock).mockResolvedValue({ id: 'sub-1' });
      (auditLog.create as jest.Mock).mockResolvedValue({});

      await service.resumeSubscription('org-1', 'user-1', 'req-1');

      expect(subscriptionsService.renewSubscription).toHaveBeenCalledWith('org-1');
      expect(auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'subscription.resumed' }),
      );
    });
  });

  describe('getTrialInfo', () => {
    it('should return isTrialing false when no trial', async () => {
      (organizations.findById as jest.Mock).mockResolvedValue({ trialEndsAt: null, plan: 'FREE' });
      const result = await service.getTrialInfo('org-1');
      expect(result.isTrialing).toBe(false);
    });

    it('should return days remaining when trialing', async () => {
      const future = new Date(Date.now() + 86400000 * 5);
      (organizations.findById as jest.Mock).mockResolvedValue({ trialEndsAt: future, plan: 'PRO' });
      const result = await service.getTrialInfo('org-1');
      expect(result.isTrialing).toBe(true);
      expect(result.daysRemaining).toBe(5);
    });
  });

  describe('getInvoiceDetails', () => {
    it('should return invoice when org matches', async () => {
      (invoices.findById as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-1',
        amount: 2900,
      });
      const result = await service.getInvoiceDetails('org-1', 'inv-1');
      expect(result.id).toBe('inv-1');
    });

    it('should throw when org does not match', async () => {
      (invoices.findById as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-2',
      });
      await expect(service.getInvoiceDetails('org-1', 'inv-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPaymentDetails', () => {
    it('should return payment when org matches', async () => {
      (payments.findById as jest.Mock).mockResolvedValue({
        id: 'pay-1',
        organizationId: 'org-1',
        amount: 2900,
      });
      const result = await service.getPaymentDetails('org-1', 'pay-1');
      expect(result.id).toBe('pay-1');
    });

    it('should throw when org does not match', async () => {
      (payments.findById as jest.Mock).mockResolvedValue({
        id: 'pay-1',
        organizationId: 'org-2',
      });
      await expect(service.getPaymentDetails('org-1', 'pay-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBillingAddress', () => {
    it('should return default address', async () => {
      const mockAddress = { id: 'addr-1', line1: '123 Main St', isDefault: true };
      (prisma.billingAddress.findFirst as jest.Mock).mockResolvedValueOnce(mockAddress);

      const result = await service.getBillingAddress('org-1');
      expect(result).toEqual(mockAddress);
    });

    it('should fallback to any address when no default', async () => {
      const mockAddress = { id: 'addr-1', line1: '123 Main St', isDefault: false };
      (prisma.billingAddress.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockAddress);

      const result = await service.getBillingAddress('org-1');
      expect(result).toEqual(mockAddress);
    });
  });

  describe('validateCoupon', () => {
    it('should delegate to coupon service', async () => {
      (coupons.validate as jest.Mock).mockResolvedValue({
        valid: true,
        discountAmount: 500,
        totalAfterDiscount: 2400,
      });

      const result = await service.validateCoupon('org-1', {
        code: 'SAVE20',
        orderAmount: 2900,
      });

      expect(coupons.validate).toHaveBeenCalledWith({
        code: 'SAVE20',
        organizationId: 'org-1',
        orderAmount: 2900,
        planId: undefined,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('getLockedFeatures', () => {
    it('should return only unavailable features', async () => {
      (features.getOrganizationFeatures as jest.Mock).mockResolvedValue([
        { slug: 'api', isAvailable: true },
        { slug: 'analytics', isAvailable: false },
        { slug: 'reports', isAvailable: false },
      ]);

      const result = await service.getLockedFeatures('org-1');
      expect(result).toHaveLength(2);
      expect(result.every((f) => !f.isAvailable)).toBe(true);
    });
  });

  describe('updateTaxInfo', () => {
    it('should merge tax info into organization settings', async () => {
      (organizations.findById as jest.Mock).mockResolvedValue({
        id: 'org-1',
        settings: { existingKey: 'val' },
      });
      (prisma.organization.update as jest.Mock).mockResolvedValue({});

      await service.updateTaxInfo('org-1', {
        taxId: 'GST123',
        taxType: 'GST',
        businessName: 'Acme Inc',
      });

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: {
          settings: expect.objectContaining({
            existingKey: 'val',
            taxId: 'GST123',
            taxType: 'GST',
            businessName: 'Acme Inc',
          }),
        },
      });
    });
  });

  describe('getUpcomingInvoice', () => {
    it('should return next invoice details', async () => {
      (subscriptionsService.getSubscription as jest.Mock).mockResolvedValue({
        planId: 'plan-1',
        status: 'ACTIVE',
      });
      (subscriptionsService.findPlanById as jest.Mock).mockResolvedValue({
        id: 'plan-1',
        name: 'Pro',
        slug: 'pro',
        price: 2900,
        currency: 'USD',
        billingInterval: 'MONTHLY',
      });
      (planResolver.resolveBillingCycle as jest.Mock).mockResolvedValue({
        currentPeriodEnd: new Date('2026-08-07'),
        daysRemaining: 30,
      });

      const result = await service.getUpcomingInvoice('org-1');
      expect(result.planName).toBe('Pro');
      expect(result.amount).toBe(2900);
      expect(result.daysRemaining).toBe(30);
    });
  });
});
