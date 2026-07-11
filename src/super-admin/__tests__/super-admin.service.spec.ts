import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SuperAdminService } from '../super-admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationsService } from '../../organizations/organizations.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { PaymentService } from '../../billing/payment.service';
import { InvoiceService } from '../../billing/invoice.service';
import { CouponService } from '../../billing/coupon.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { RbacService } from '../../rbac/rbac.service';
import { FeatureResolver } from '../../subscriptions/feature-resolver.service';
import { UsageResolver } from '../../subscriptions/usage-resolver.service';

describe('SuperAdminService', () => {
  let service: SuperAdminService;
  let prisma: DeepMockProxy<PrismaService>;
  let organizations: DeepMockProxy<OrganizationsService>;
  let subscriptionsService: DeepMockProxy<SubscriptionsService>;
  let payments: DeepMockProxy<PaymentService>;
  let invoices: DeepMockProxy<InvoiceService>;
  let coupons: DeepMockProxy<CouponService>;
  let auditLog: DeepMockProxy<AuditLogService>;
  let rbac: DeepMockProxy<RbacService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    organizations = mockDeep<OrganizationsService>();
    subscriptionsService = mockDeep<SubscriptionsService>();
    payments = mockDeep<PaymentService>();
    invoices = mockDeep<InvoiceService>();
    coupons = mockDeep<CouponService>();
    auditLog = mockDeep<AuditLogService>();
    rbac = mockDeep<RbacService>();
    const features = mockDeep<FeatureResolver>();
    const usage = mockDeep<UsageResolver>();

    service = new SuperAdminService(
      prisma,
      organizations,
      subscriptionsService,
      payments,
      invoices,
      coupons,
      auditLog,
      rbac,
      features,
      usage,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('listOrganizations', () => {
    it('should return paginated orgs with counts', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Acme',
        code: 'acme',
        slug: 'acme',
        status: 'ACTIVE',
        plan: 'PRO',
      };
      (prisma.organization.findMany as jest.Mock).mockResolvedValue([mockOrg]);
      (prisma.organization.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listOrganizations({});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('suspendOrganization', () => {
    it('should suspend and audit log', async () => {
      (organizations.findById as jest.Mock).mockResolvedValue({ id: 'org-1', status: 'ACTIVE' });
      (prisma.organization.update as jest.Mock).mockResolvedValue({
        id: 'org-1',
        status: 'SUSPENDED',
      });

      const result = await service.suspendOrganization('org-1', 'admin-1', 'req-1');
      expect(result.status).toBe('SUSPENDED');
    });
  });

  describe('softDeleteOrganization', () => {
    it('should soft delete and audit log', async () => {
      (organizations.softDelete as jest.Mock).mockResolvedValue(undefined);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.softDeleteOrganization('org-1', 'admin-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  describe('createFeature', () => {
    it('should create a feature with auto-created group', async () => {
      (prisma.permissionGroup.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.permissionGroup.create as jest.Mock).mockResolvedValue({
        id: 'g-1',
        slug: 'integrations',
      });
      (prisma.feature.create as jest.Mock).mockResolvedValue({
        id: 'f-1',
        slug: 'api-access',
        name: 'API Access',
      });

      const result = await service.createFeature({
        name: 'API Access',
        slug: 'api-access',
        group: 'integrations',
      });
      expect(prisma.permissionGroup.create).toHaveBeenCalled();
      expect(result.slug).toBe('api-access');
    });
  });

  describe('getRevenueStats', () => {
    it('should aggregate payment data', async () => {
      (prisma.payment.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 100000, netAmount: 95000, feeAmount: 5000 },
        _count: 50,
      });

      const result = await service.getRevenueStats();
      expect(result.totalRevenue).toBe(100000);
      expect(result.transactionCount).toBe(50);
    });
  });

  describe('getMrr', () => {
    it('should calculate MRR from active subscriptions', async () => {
      (prisma.organizationSubscription.findMany as jest.Mock).mockResolvedValue([
        { plan: { price: 2900, billingInterval: 'MONTHLY' } },
        { plan: { price: 9900, billingInterval: 'MONTHLY' } },
      ]);
      const result = await service.getMrr();
      expect(result.mrr).toBe(12800);
    });
  });

  describe('getDashboardStats', () => {
    it('should return aggregated stats', async () => {
      (prisma.organization.count as jest.Mock).mockResolvedValue(10);
      (prisma.organization.groupBy as jest.Mock).mockResolvedValue([
        { status: 'ACTIVE', _count: 8 },
      ]);
      (prisma.organization.groupBy as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ status: 'ACTIVE', _count: 8 }]);
      (prisma.organization.groupBy as jest.Mock).mockResolvedValue([{ plan: 'PRO', _count: 5 }]);
      (prisma.user.count as jest.Mock).mockResolvedValue(100);
      (prisma.user.count as jest.Mock).mockResolvedValueOnce(100).mockResolvedValueOnce(80);
      (prisma.payment.count as jest.Mock).mockResolvedValue(500);
      (prisma.payment.count as jest.Mock)
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);
      (prisma.payment.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 500000, netAmount: 475000, feeAmount: 25000 },
        _count: 500,
      });

      (prisma.organizationSubscription.findMany as jest.Mock).mockResolvedValue([
        { plan: { price: 2900, billingInterval: 'MONTHLY' } },
      ]);

      const stats = await service.getDashboardStats();
      expect(stats.organizations.total).toBe(10);
      expect(stats.users.active).toBe(80);
      expect(stats.revenue.mrr).toBe(2900);
    });
  });

  describe('assignFeatureToPlan', () => {
    it('should assign feature to plan', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue({ id: 'plan-1' });
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue({ id: 'feat-1' });
      (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.planFeature.create as jest.Mock).mockResolvedValue({ id: 'pf-1' });

      const result = await service.assignFeatureToPlan('plan-1', 'feat-1', '100');
      expect(result.id).toBe('pf-1');
    });

    it('should throw if already assigned', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue({ id: 'plan-1' });
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue({ id: 'feat-1' });
      (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({ id: 'pf-1' });

      await expect(service.assignFeatureToPlan('plan-1', 'feat-1')).rejects.toThrow();
    });
  });

  describe('duplicatePlan', () => {
    it('should duplicate a plan', async () => {
      (subscriptionsService.findPlanById as jest.Mock).mockResolvedValue({
        id: 'plan-1',
        name: 'Pro',
        slug: 'pro',
        description: 'Pro plan',
        billingInterval: 'MONTHLY',
        price: 2900,
        currency: 'USD',
        trialPeriodDays: 14,
      });
      (subscriptionsService.createPlan as jest.Mock).mockResolvedValue({
        id: 'plan-2',
        name: 'Pro (Copy)',
      });

      const result = await service.duplicatePlan('plan-1', {}, 'req-1', 'admin-1');
      expect(result.name).toBe('Pro (Copy)');
    });
  });

  describe('getAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([{ id: 'log-1', event: 'test' }]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getAuditLogs(1, 50, 'test');
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
