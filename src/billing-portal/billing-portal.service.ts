import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../billing/payment.service';
import { InvoiceService } from '../billing/invoice.service';
import { CouponService } from '../billing/coupon.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SubscriptionService } from '../subscriptions/subscription.service';
import { PlanResolver } from '../subscriptions/plan-resolver.service';
import { FeatureResolver } from '../subscriptions/feature-resolver.service';
import { UsageResolver } from '../subscriptions/usage-resolver.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UpgradePlanDto } from './dto/upgrade-plan.dto';
import { DowngradePlanDto } from './dto/downgrade-plan.dto';
import { PreviewDiscountDto } from './dto/preview-discount.dto';
import { BillingAddressDto } from './dto/billing-address.dto';
import { CompanyInfoDto } from './dto/company-info.dto';
import { TaxInfoDto } from './dto/tax-info.dto';
import { PaymentQueryDto } from '../billing/dto/payment-query.dto';
import { InvoiceQueryDto } from '../billing/dto/invoice-query.dto';
import { PlanQueryDto } from '../subscriptions/dto/plan-query.dto';

@Injectable()
export class BillingPortalService {
  private readonly logger = new Logger(BillingPortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
    private readonly invoices: InvoiceService,
    private readonly coupons: CouponService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly subscriptionService: SubscriptionService,
    private readonly planResolver: PlanResolver,
    private readonly features: FeatureResolver,
    private readonly usage: UsageResolver,
    private readonly organizations: OrganizationsService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ─── Subscription ────────────────────────

  async getCurrentSubscription(organizationId: string) {
    const subscription = await this.subscriptionsService.getSubscription(organizationId);
    const org = await this.organizations.findById(organizationId);
    return {
      ...subscription,
      trialEndsAt: org.trialEndsAt,
      organizationPlan: org.plan,
    };
  }

  async getAvailablePlans(query: PlanQueryDto) {
    return this.subscriptionsService.findAllPlans({ ...query, isActive: true });
  }

  async comparePlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        features: {
          include: { feature: true },
          orderBy: { feature: { group: 'asc' } },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      billingInterval: plan.billingInterval,
      price: plan.price,
      currency: plan.currency,
      trialPeriodDays: plan.trialPeriodDays,
      features: plan.features.map((pf) => ({
        slug: pf.feature.slug,
        name: pf.feature.name,
        group: pf.feature.group,
        value: pf.value,
        isAvailable: pf.isAvailable,
      })),
    }));
  }

  async upgradePlan(
    organizationId: string,
    dto: UpgradePlanDto,
    actorId: string,
    requestId: string,
  ) {
    const result = await this.subscriptionsService.changePlan(organizationId, {
      planId: dto.planId,
      immediate: dto.immediate,
    });
    await this.auditLog.create({
      organizationId,
      actorId,
      actorType: 'USER',
      event: 'subscription.plan.upgraded',
      resource: 'organization_subscription',
      resourceId: organizationId,
      action: 'UPDATE',
      details: { targetPlanId: dto.planId, immediate: dto.immediate ?? false },
      requestId,
      severity: 'INFO',
    });
    return result;
  }

  async downgradePlan(
    organizationId: string,
    dto: DowngradePlanDto,
    actorId: string,
    requestId: string,
  ) {
    const result = await this.subscriptionsService.changePlan(organizationId, {
      planId: dto.planId,
      immediate: false,
    });
    await this.auditLog.create({
      organizationId,
      actorId,
      actorType: 'USER',
      event: 'subscription.plan.downgraded',
      resource: 'organization_subscription',
      resourceId: organizationId,
      action: 'UPDATE',
      details: { targetPlanId: dto.planId },
      requestId,
      severity: 'INFO',
    });
    return result;
  }

  async cancelSubscription(organizationId: string, actorId: string, requestId: string) {
    const result = await this.subscriptionsService.cancelSubscription(organizationId);
    await this.auditLog.create({
      organizationId,
      actorId,
      actorType: 'USER',
      event: 'subscription.canceled',
      resource: 'organization_subscription',
      resourceId: organizationId,
      action: 'UPDATE',
      details: {},
      requestId,
      severity: 'WARN',
    });
    return result;
  }

  async resumeSubscription(organizationId: string, actorId: string, requestId: string) {
    const result = await this.subscriptionsService.renewSubscription(organizationId);
    await this.auditLog.create({
      organizationId,
      actorId,
      actorType: 'USER',
      event: 'subscription.resumed',
      resource: 'organization_subscription',
      resourceId: organizationId,
      action: 'UPDATE',
      details: {},
      requestId,
      severity: 'INFO',
    });
    return result;
  }

  async getTrialInfo(organizationId: string) {
    const org = await this.organizations.findById(organizationId);
    if (!org.trialEndsAt) {
      return { isTrialing: false, trialEndsAt: null, daysRemaining: 0 };
    }
    const now = new Date();
    const diffMs = org.trialEndsAt.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    return {
      isTrialing: daysRemaining > 0 && org.plan !== 'FREE',
      trialEndsAt: org.trialEndsAt,
      daysRemaining,
    };
  }

  async getRenewalInfo(organizationId: string) {
    const cycle = await this.planResolver.resolveBillingCycle(organizationId);
    const renewal = await this.planResolver.resolveRenewalDate(organizationId);
    return { ...cycle, ...renewal };
  }

  // ─── Invoices ─────────────────────────────

  async getInvoiceHistory(organizationId: string, query: InvoiceQueryDto) {
    return this.invoices.findAll({ ...query, organizationId });
  }

  async getInvoiceDetails(organizationId: string, invoiceId: string) {
    const invoice = await this.invoices.findById(invoiceId);
    if (invoice.organizationId !== organizationId) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async getInvoiceDownload(organizationId: string, invoiceId: string) {
    const invoice = await this.getInvoiceDetails(organizationId, invoiceId);
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      organizationId: invoice.organizationId,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      taxAmount: invoice.taxAmount,
      discountAmount: invoice.discountAmount,
      totalAmount: invoice.totalAmount,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      dueAt: invoice.dueAt,
      paidAt: invoice.paidAt,
      billingAddressId: invoice.billingAddressId,
      notes: invoice.notes,
      metadata: invoice.metadata,
    };
  }

  async getUpcomingInvoice(organizationId: string) {
    const subscription = await this.subscriptionsService.getSubscription(organizationId);
    const plan = await this.subscriptionsService.findPlanById(subscription.planId);
    const cycle = await this.planResolver.resolveBillingCycle(organizationId);
    return {
      planName: plan.name,
      planSlug: plan.slug,
      amount: plan.price,
      currency: plan.currency,
      interval: plan.billingInterval,
      nextBillingDate: cycle.currentPeriodEnd,
      daysRemaining: cycle.daysRemaining,
    };
  }

  // ─── Payments ─────────────────────────────

  async getPaymentHistory(organizationId: string, query: PaymentQueryDto) {
    return this.payments.findByOrganization(organizationId, query);
  }

  async getPaymentDetails(organizationId: string, paymentId: string) {
    const payment = await this.payments.findById(paymentId);
    if (payment.organizationId !== organizationId) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async getPaymentStatus(organizationId: string, paymentId: string) {
    const payment = await this.getPaymentDetails(organizationId, paymentId);
    return {
      id: payment.id,
      status: payment.status,
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
      failedAt: payment.failedAt,
      failureReason: payment.failureReason,
      refundedAmount: payment.refundedAmount,
    };
  }

  // ─── Usage ────────────────────────────────

  async getCurrentUsage(organizationId: string) {
    return this.usage.getUsage(organizationId);
  }

  async getRemainingLimits(organizationId: string) {
    return this.usage.getUsage(organizationId);
  }

  async getUsageHistory(organizationId: string) {
    return this.usage.getUsage(organizationId);
  }

  // ─── Features ─────────────────────────────

  async getCurrentPlanFeatures(organizationId: string) {
    return this.features.getOrganizationFeatures(organizationId);
  }

  async getLockedFeatures(organizationId: string) {
    const allFeatures = await this.features.getOrganizationFeatures(organizationId);
    return allFeatures.filter((f) => !f.isAvailable);
  }

  async getFeatureAvailability(organizationId: string, featureSlug: string) {
    return this.features.checkFeature(organizationId, featureSlug);
  }

  // ─── Coupons ──────────────────────────────

  async validateCoupon(organizationId: string, dto: PreviewDiscountDto) {
    return this.coupons.validate({
      code: dto.code,
      organizationId,
      orderAmount: dto.orderAmount,
      planId: dto.planId,
    });
  }

  async previewDiscount(organizationId: string, dto: PreviewDiscountDto) {
    return this.coupons.validate({
      code: dto.code,
      organizationId,
      orderAmount: dto.orderAmount,
      planId: dto.planId,
    });
  }

  async applyCoupon(organizationId: string, dto: PreviewDiscountDto) {
    return this.coupons.apply({
      code: dto.code,
      organizationId,
      orderAmount: dto.orderAmount,
      planId: dto.planId,
    });
  }

  // ─── Billing Profile ──────────────────────

  async getBillingAddress(organizationId: string) {
    const address = await this.prisma.billingAddress.findFirst({
      where: { organizationId, isDefault: true },
    });
    if (!address) {
      const anyAddress = await this.prisma.billingAddress.findFirst({
        where: { organizationId },
      });
      return anyAddress;
    }
    return address;
  }

  async upsertBillingAddress(organizationId: string, dto: BillingAddressDto) {
    const existing = await this.prisma.billingAddress.findFirst({
      where: { organizationId, isDefault: true },
    });
    if (existing) {
      return this.prisma.billingAddress.update({
        where: { id: existing.id },
        data: dto,
      });
    }
    return this.prisma.billingAddress.create({
      data: { ...dto, organizationId, isDefault: dto.isDefault ?? true },
    });
  }

  async getCompanyInfo(organizationId: string) {
    const org = await this.organizations.findById(organizationId);
    return {
      name: org.name,
      logoUrl: org.logoUrl,
      domain: org.domain,
      settings: org.settings,
    };
  }

  async updateCompanyInfo(organizationId: string, dto: CompanyInfoDto) {
    return this.organizations.update(organizationId, dto);
  }

  async getTaxInfo(organizationId: string) {
    const org = await this.organizations.findById(organizationId);
    const settings = (org.settings as Record<string, unknown>) ?? {};
    return {
      taxId: settings.taxId ?? null,
      taxType: settings.taxType ?? null,
      businessName: settings.businessName ?? null,
      address: settings.taxAddress ?? null,
    };
  }

  async updateTaxInfo(organizationId: string, dto: TaxInfoDto) {
    const org = await this.organizations.findById(organizationId);
    const settings = (org.settings as Record<string, unknown>) ?? {};
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        settings: {
          ...settings,
          ...(dto.taxId !== undefined && { taxId: dto.taxId }),
          ...(dto.taxType !== undefined && { taxType: dto.taxType }),
          ...(dto.businessName !== undefined && { businessName: dto.businessName }),
          ...(dto.address !== undefined && { taxAddress: dto.address }),
        },
      },
    });
    return this.getTaxInfo(organizationId);
  }
}
