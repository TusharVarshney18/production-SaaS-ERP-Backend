import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentService } from '../billing/payment.service';
import { InvoiceService } from '../billing/invoice.service';
import { CouponService } from '../billing/coupon.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RbacService } from '../rbac/rbac.service';
import { FeatureResolver } from '../subscriptions/feature-resolver.service';
import { UsageResolver } from '../subscriptions/usage-resolver.service';
import { SuperAdminOrgQueryDto } from './dto/super-admin-org-query.dto';
import { ChangeOrgPlanDto } from './dto/change-org-plan.dto';
import { OverrideUsageLimitsDto } from './dto/override-usage-limits.dto';
import { OverrideFeatureFlagsDto } from './dto/override-feature-flags.dto';
import { DuplicatePlanDto } from './dto/duplicate-plan.dto';
import { PlanPricingDto } from './dto/plan-pricing.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateSystemSettingDto } from './dto/update-system-setting.dto';

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly payments: PaymentService,
    private readonly invoices: InvoiceService,
    private readonly coupons: CouponService,
    private readonly auditLog: AuditLogService,
    private readonly rbac: RbacService,
    private readonly features: FeatureResolver,
    private readonly usage: UsageResolver,
  ) {}

  // ─── Audit Helper ─────────────────────────

  private async log(
    orgId: string | null,
    actorId: string,
    event: string,
    action: string,
    details: Record<string, unknown>,
    requestId: string,
  ) {
    await this.auditLog.create({
      organizationId: orgId || 'system',
      actorId,
      actorType: 'USER',
      event,
      resource: 'super_admin',
      resourceId: orgId || 'system',
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  // ─── Organizations ────────────────────────

  async listOrganizations(query: SuperAdminOrgQueryDto) {
    const {
      search,
      status,
      plan,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (plan) where.plan = plan;

    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { users: { where: { deletedAt: null } } } },
          subscription: true,
          orgSettings: true,
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getOrganizationDetail(id: string) {
    return this.organizations.findById(id);
  }

  async suspendOrganization(id: string, actorId: string, requestId: string) {
    const org = await this.organizations.findById(id);
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
    await this.log(
      id,
      actorId,
      'organization.suspended',
      'UPDATE',
      { previousStatus: org.status },
      requestId,
    );
    return updated;
  }

  async restoreOrganization(id: string, actorId: string, requestId: string) {
    await this.organizations.findById(id);
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
    await this.log(id, actorId, 'organization.restored', 'UPDATE', {}, requestId);
    return updated;
  }

  async softDeleteOrganization(id: string, actorId: string, requestId: string) {
    await this.organizations.softDelete(id, actorId, 'Super admin action');
    await this.log(id, actorId, 'organization.deleted', 'DELETE', {}, requestId);
    return { message: 'Organization deleted' };
  }

  async reactivateOrganization(id: string, actorId: string, requestId: string) {
    await this.organizations.findById(id);
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: null, deletedByUserId: null, deletedReason: null, status: 'ACTIVE' },
    });
    await this.log(id, actorId, 'organization.reactivated', 'UPDATE', {}, requestId);
    return updated;
  }

  async changeOrganizationPlan(
    id: string,
    dto: ChangeOrgPlanDto,
    actorId: string,
    requestId: string,
  ) {
    await this.organizations.findById(id);
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { plan: dto.plan as never },
    });
    await this.log(
      id,
      actorId,
      'organization.plan_changed',
      'UPDATE',
      { newPlan: dto.plan },
      requestId,
    );
    return updated;
  }

  async overrideUsageLimits(
    orgId: string,
    dto: OverrideUsageLimitsDto,
    actorId: string,
    requestId: string,
  ) {
    await this.organizations.findById(orgId);
    const counters = await this.prisma.usageCounter.findMany({
      where: { organizationId: orgId },
    });
    for (const c of counters) {
      await this.prisma.usageCounter.update({
        where: { id: c.id },
        data: {
          ...(dto.softLimit !== undefined && { softLimit: dto.softLimit }),
          ...(dto.hardLimit !== undefined && { hardLimit: dto.hardLimit }),
        },
      });
    }
    await this.log(
      orgId,
      actorId,
      'organization.usage_limits_override',
      'UPDATE',
      dto as never,
      requestId,
    );
    return { message: 'Usage limits updated', affectedCount: counters.length };
  }

  async overrideFeatureFlags(
    orgId: string,
    dto: OverrideFeatureFlagsDto,
    actorId: string,
    requestId: string,
  ) {
    await this.organizations.findById(orgId);
    const feature = await this.prisma.feature.findUnique({ where: { slug: dto.featureSlug } });
    if (!feature) throw new NotFoundException('Feature not found');

    const counter = await this.prisma.usageCounter.findFirst({
      where: { organizationId: orgId, featureId: feature.id },
    });
    if (counter) {
      await this.prisma.usageCounter.update({
        where: { id: counter.id },
        data: {
          ...(dto.value !== undefined && { hardLimit: parseInt(dto.value, 10) || 0 }),
        },
      });
    }
    await this.log(
      orgId,
      actorId,
      'organization.feature_override',
      'UPDATE',
      dto as never,
      requestId,
    );
    return { message: 'Feature flag updated' };
  }

  // ─── Subscription Plans ───────────────────

  async createPlan(dto: Record<string, unknown>) {
    return this.subscriptionsService.createPlan(dto as never);
  }

  async updatePlan(id: string, dto: Record<string, unknown>) {
    return this.subscriptionsService.updatePlan(id, dto as never);
  }

  async archivePlan(id: string, actorId: string, requestId: string) {
    await this.subscriptionsService.findPlanById(id);
    const updated = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date(), deletedByUserId: actorId },
    });
    await this.log(null, actorId, 'plan.archived', 'UPDATE', { planId: id }, requestId);
    return updated;
  }

  async restorePlan(id: string, requestId: string, actorId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan || !plan.deletedAt) throw new NotFoundException('Plan not found or not archived');
    const updated = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { deletedAt: null, deletedByUserId: null, isActive: true },
    });
    await this.log(null, actorId, 'plan.restored', 'UPDATE', { planId: id }, requestId);
    return updated;
  }

  async deletePlan(id: string, actorId: string, requestId: string) {
    await this.subscriptionsService.softDeletePlan(id, actorId, 'Super admin action');
    await this.log(null, actorId, 'plan.deleted', 'DELETE', { planId: id }, requestId);
    return { message: 'Plan deleted' };
  }

  async duplicatePlan(id: string, dto: DuplicatePlanDto, requestId: string, actorId: string) {
    const original = await this.subscriptionsService.findPlanById(id);
    const newPlan = await this.subscriptionsService.createPlan({
      name: dto.name || `${original.name} (Copy)`,
      slug: dto.slug || `${original.slug}-copy`,
      description: original.description || undefined,
      billingInterval: original.billingInterval,
      price: original.price,
      currency: original.currency || 'USD',
      trialPeriodDays: original.trialPeriodDays || 0,
      isActive: false,
    } as never);
    await this.log(
      null,
      actorId,
      'plan.duplicated',
      'CREATE',
      { sourcePlanId: id, newPlanId: newPlan.id },
      requestId,
    );
    return newPlan;
  }

  async updatePlanPricing(id: string, dto: PlanPricingDto, actorId: string, requestId: string) {
    await this.subscriptionsService.findPlanById(id);
    const updated = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.trialPeriodDays !== undefined && { trialPeriodDays: dto.trialPeriodDays }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    await this.log(
      null,
      actorId,
      'plan.pricing_updated',
      'UPDATE',
      { planId: id, ...dto },
      requestId,
    );
    return updated;
  }

  // ─── Features ─────────────────────────────

  async createFeature(dto: { name: string; slug: string; description?: string; group?: string }) {
    const group = dto.group || 'general';
    let permissionGroup = await this.prisma.permissionGroup.findUnique({ where: { slug: group } });
    if (!permissionGroup) {
      permissionGroup = await this.prisma.permissionGroup.create({
        data: {
          name: group.charAt(0).toUpperCase() + group.slice(1),
          slug: group,
          displayOrder: 0,
        },
      });
    }
    return this.prisma.feature.create({
      data: { name: dto.name, slug: dto.slug, description: dto.description || null, group: group },
    });
  }

  async updateFeature(id: string, dto: { name?: string; description?: string; group?: string }) {
    const feature = await this.prisma.feature.findUnique({ where: { id } });
    if (!feature) throw new NotFoundException('Feature not found');
    return this.prisma.feature.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.group !== undefined && { group: dto.group }),
      },
    });
  }

  async deleteFeature(id: string) {
    const feature = await this.prisma.feature.findUnique({ where: { id } });
    if (!feature) throw new NotFoundException('Feature not found');
    await this.prisma.planFeature.deleteMany({ where: { featureId: id } });
    await this.prisma.usageCounter.deleteMany({ where: { featureId: id } });
    await this.prisma.feature.delete({ where: { id } });
    return { message: 'Feature deleted' };
  }

  async assignFeatureToPlan(planId: string, featureId: string, value?: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    const feature = await this.prisma.feature.findUnique({ where: { id: featureId } });
    if (!feature) throw new NotFoundException('Feature not found');
    const existing = await this.prisma.planFeature.findUnique({
      where: { planId_featureId: { planId, featureId } },
    });
    if (existing) throw new BadRequestException('Feature already assigned to this plan');
    return this.prisma.planFeature.create({
      data: { planId, featureId, value: value || 'true', isAvailable: true },
    });
  }

  async removeFeatureFromPlan(planId: string, featureId: string) {
    const existing = await this.prisma.planFeature.findUnique({
      where: { planId_featureId: { planId, featureId } },
    });
    if (!existing) throw new NotFoundException('Feature not assigned to this plan');
    await this.prisma.planFeature.delete({ where: { planId_featureId: { planId, featureId } } });
    return { message: 'Feature removed from plan' };
  }

  async enableFeature(id: string) {
    const pf = await this.prisma.planFeature.findUnique({ where: { id } });
    if (!pf) throw new NotFoundException('Plan feature not found');
    return this.prisma.planFeature.update({ where: { id }, data: { isAvailable: true } });
  }

  async disableFeature(id: string) {
    const pf = await this.prisma.planFeature.findUnique({ where: { id } });
    if (!pf) throw new NotFoundException('Plan feature not found');
    return this.prisma.planFeature.update({ where: { id }, data: { isAvailable: false } });
  }

  // ─── Coupons ──────────────────────────────

  async listCoupons() {
    return this.coupons.findAll({});
  }

  async disableCoupon(id: string) {
    return this.coupons.update(id, { isActive: false } as never);
  }

  async expireCoupon(id: string) {
    return this.coupons.update(id, { expiresAt: new Date().toISOString() } as never);
  }

  async deleteCoupon(id: string, userId: string) {
    await this.coupons.softDelete(id, userId, 'Super admin action');
    return { message: 'Coupon deleted' };
  }

  async getCouponAnalytics() {
    const coupons = await this.prisma.coupon.findMany({
      include: { _count: { select: { usages: true } } },
    });
    const totalUses = coupons.reduce((sum, c) => sum + c.usedCount, 0);
    const activeCoupons = coupons.filter((c) => c.isActive).length;
    return { totalCoupons: coupons.length, activeCoupons, totalUses, coupons };
  }

  // ─── Payments ─────────────────────────────

  async getAllPayments(page = 1, limit = 20) {
    return this.payments.findAll({ page, limit, sortBy: 'createdAt', sortOrder: 'desc' });
  }

  async getFailedPayments(page = 1, limit = 20) {
    return this.payments.findAll({
      status: 'FAILED',
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }

  async getRefundedPayments(page = 1, limit = 20) {
    return this.payments.findAll({
      status: 'REFUNDED',
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }

  async getRevenueStats() {
    const succeeded = await this.prisma.payment.aggregate({
      where: { status: 'SUCCEEDED' },
      _sum: { amount: true, netAmount: true, feeAmount: true },
      _count: true,
    });
    return {
      totalRevenue: succeeded._sum.amount || 0,
      totalNetRevenue: succeeded._sum.netAmount || 0,
      totalFees: succeeded._sum.feeAmount || 0,
      transactionCount: succeeded._count,
    };
  }

  async getMrr() {
    const activeSubs = await this.prisma.organizationSubscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIAL', 'GRACE_PERIOD'] },
        plan: { billingInterval: 'MONTHLY' },
      },
      include: { plan: true },
    });
    const mrr = activeSubs.reduce((sum, sub) => sum + sub.plan.price, 0);
    return { mrr, subscriptionCount: activeSubs.length };
  }

  async getArr() {
    const monthly = await this.getMrr();
    return { arr: monthly.mrr * 12, monthlyMrr: monthly.mrr };
  }

  // ─── Invoices ─────────────────────────────

  async getAllInvoices(page = 1, limit = 20, search?: string) {
    return this.invoices.findAll({
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      search,
    } as never);
  }

  async downloadInvoiceMeta(id: string) {
    const invoice = await this.invoices.findById(id);
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      organizationId: invoice.organizationId,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      dueAt: invoice.dueAt,
      metadata: invoice.metadata,
    };
  }

  // ─── Announcements ────────────────────────

  async createAnnouncement(dto: CreateAnnouncementDto) {
    return this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body || null,
        severity: (dto.severity as never) || 'INFO',
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isPublished: dto.isPublished ?? false,
      },
    });
  }

  async publishAnnouncement(id: string) {
    const ann = await this.prisma.announcement.findUnique({ where: { id } });
    if (!ann) throw new NotFoundException('Announcement not found');
    return this.prisma.announcement.update({
      where: { id },
      data: { isPublished: true, startsAt: new Date() },
    });
  }

  async scheduleAnnouncement(id: string, startsAt: string) {
    const ann = await this.prisma.announcement.findUnique({ where: { id } });
    if (!ann) throw new NotFoundException('Announcement not found');
    return this.prisma.announcement.update({
      where: { id },
      data: { startsAt: new Date(startsAt), isPublished: false },
    });
  }

  // ─── System Settings ──────────────────────

  async getSystemSettings() {
    const settings = await this.prisma.systemSetting.findMany({ orderBy: { category: 'asc' } });
    const grouped: Record<string, unknown[]> = {};
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }
    return grouped;
  }

  async updateSystemSetting(dto: UpdateSystemSettingDto) {
    return this.prisma.systemSetting.upsert({
      where: { key: dto.key },
      create: {
        key: dto.key,
        value: dto.value,
        description: dto.description || null,
        category: 'general',
      },
      update: { value: dto.value, description: dto.description },
    });
  }

  // ─── Dashboard Stats ──────────────────────

  async getDashboardStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalOrgs,
      orgsByStatus,
      orgsByPlan,
      totalUsers,
      activeUsers,
      totalPayments,
      paymentsToday,
      failedPayments,
      revenue,
      mrrData,
    ] = await Promise.all([
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.organization.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),
      this.prisma.organization.groupBy({ by: ['plan'], where: { deletedAt: null }, _count: true }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.payment.count(),
      this.prisma.payment.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.payment.count({ where: { status: 'FAILED' } }),
      this.getRevenueStats(),
      this.getMrr(),
    ]);

    return {
      organizations: {
        total: totalOrgs,
        byStatus: orgsByStatus,
        byPlan: orgsByPlan,
      },
      users: { total: totalUsers, active: activeUsers },
      payments: { total: totalPayments, today: paymentsToday, failed: failedPayments },
      revenue: {
        total: revenue.totalRevenue,
        net: revenue.totalNetRevenue,
        fees: revenue.totalFees,
        mrr: mrrData.mrr,
        arr: mrrData.mrr * 12,
      },
    };
  }

  // ─── Audit Logs ───────────────────────────

  async getAuditLogs(page = 1, limit = 50, search?: string) {
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { event: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
