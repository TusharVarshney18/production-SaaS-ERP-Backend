# Sprint 3.7 — Customer Billing Portal Backend

## Summary

Created a customer-facing billing portal API layer that reuses existing services (`PaymentService`, `InvoiceService`, `CouponService`, `SubscriptionsService`, `FeatureResolver`, `UsageResolver`, `PlanResolver`, `OrganizationsService`, `AuditLogService`). No business logic in controllers — all delegation happens in a thin `BillingPortalService`.

## Architecture

```
BillingPortalController (routes)
        │
        ▼
BillingPortalService (orchestration + audit logging)
        │
        ▼
   ┌────┼────┬────┬────┬────┬────┐
   │    │    │    │    │    │    │
  Prisma Svc  │    │    │    │  AuditLog Svc
   PaymentSvc  │    │    │ OrganizationsSvc
    InvoiceSvc  │    │ SubscriptionsSvc
     CouponSvc FeatureResolver
              UsageResolver
              PlanResolver
```

## Files Created

| File | Purpose |
|------|---------|
| `src/billing-portal/billing-portal.module.ts` | Module importing Billing, Subscriptions, AuditLog, Organizations |
| `src/billing-portal/billing-portal.controller.ts` | REST controller with 31 endpoints, Swagger decorators |
| `src/billing-portal/billing-portal.service.ts` | Orchestration service — delegates to existing services |
| `src/billing-portal/dto/upgrade-plan.dto.ts` | `planId`, `immediate?` |
| `src/billing-portal/dto/downgrade-plan.dto.ts` | `planId` |
| `src/billing-portal/dto/preview-discount.dto.ts` | `code`, `orderAmount?`, `planId?` |
| `src/billing-portal/dto/billing-address.dto.ts` | `line1`, `line2?`, `city`, `state?`, `postalCode?`, `country`, `fullName?`, `phone?`, `email?`, `isDefault?` |
| `src/billing-portal/dto/company-info.dto.ts` | `name?`, `logoUrl?`, `domain?` |
| `src/billing-portal/dto/tax-info.dto.ts` | `taxId?`, `taxType?`, `businessName?`, `address?` |
| `src/billing-portal/__tests__/billing-portal.service.spec.ts` | 17 unit tests |

## Files Modified

| File | Change |
|------|--------|
| `src/app.module.ts` | Added `BillingPortalModule` import |

## Endpoints (31 total)

### Subscription (7)
| Method | Route | Delegates To |
|--------|-------|-------------|
| `GET` | `billing-portal/organizations/:orgId/subscription` | `SubscriptionsService.getSubscription` + `OrganizationsService.findById` |
| `PATCH` | `billing-portal/organizations/:orgId/subscription/upgrade` | `SubscriptionsService.changePlan` |
| `PATCH` | `billing-portal/organizations/:orgId/subscription/downgrade` | `SubscriptionsService.changePlan` |
| `POST` | `billing-portal/organizations/:orgId/subscription/cancel` | `SubscriptionsService.cancelSubscription` |
| `POST` | `billing-portal/organizations/:orgId/subscription/resume` | `SubscriptionsService.renewSubscription` |
| `GET` | `billing-portal/organizations/:orgId/subscription/trial` | `OrganizationsService.findById` |
| `GET` | `billing-portal/organizations/:orgId/subscription/renewal` | `PlanResolver.resolveBillingCycle` + `resolveRenewalDate` |

### Plans (2)
| Method | Route | Delegates To |
|--------|-------|-------------|
| `GET` | `billing-portal/organizations/:orgId/plans` | `SubscriptionsService.findAllPlans` |
| `GET` | `billing-portal/organizations/:orgId/plans/compare` | Prisma `subscriptionPlan.findMany` with features |

### Invoices (4)
| Method | Route | Delegates To |
|--------|-------|-------------|
| `GET` | `billing-portal/organizations/:orgId/invoices` | `InvoiceService.findAll` (paginated, filterable) |
| `GET` | `billing-portal/organizations/:orgId/invoices/upcoming` | `SubscriptionsService` + `PlanResolver` |
| `GET` | `billing-portal/organizations/:orgId/invoices/:invoiceId` | `InvoiceService.findById` |
| `GET` | `billing-portal/organizations/:orgId/invoices/:invoiceId/download` | `InvoiceService.findById` (returns metadata) |

### Payments (3)
| Method | Route | Delegates To |
|--------|-------|-------------|
| `GET` | `billing-portal/organizations/:orgId/payments` | `PaymentService.findByOrganization` (paginated) |
| `GET` | `billing-portal/organizations/:orgId/payments/:paymentId` | `PaymentService.findById` |
| `GET` | `billing-portal/organizations/:orgId/payments/:paymentId/status` | `PaymentService.findById` (returns status subset) |

### Usage (3)
| Method | Route | Delegates To |
|--------|-------|-------------|
| `GET` | `billing-portal/organizations/:orgId/usage` | `UsageResolver.getUsage` |
| `GET` | `billing-portal/organizations/:orgId/usage/remaining` | `UsageResolver.getUsage` |
| `GET` | `billing-portal/organizations/:orgId/usage/history` | `UsageResolver.getUsage` |

### Features (3)
| Method | Route | Delegates To |
|--------|-------|-------------|
| `GET` | `billing-portal/organizations/:orgId/features` | `FeatureResolver.getOrganizationFeatures` |
| `GET` | `billing-portal/organizations/:orgId/features/locked` | `FeatureResolver.getOrganizationFeatures` (filtered) |
| `GET` | `billing-portal/organizations/:orgId/features/:slug/availability` | `FeatureResolver.checkFeature` |

### Coupons (3)
| Method | Route | Delegates To |
|--------|-------|-------------|
| `POST` | `billing-portal/organizations/:orgId/coupons/validate` | `CouponService.validate` |
| `POST` | `billing-portal/organizations/:orgId/coupons/preview` | `CouponService.validate` |
| `POST` | `billing-portal/organizations/:orgId/coupons/apply` | `CouponService.apply` |

### Billing Profile (6)
| Method | Route | Delegates To |
|--------|-------|-------------|
| `GET` | `billing-portal/organizations/:orgId/billing-address` | Prisma `billingAddress.findFirst` |
| `PUT` | `billing-portal/organizations/:orgId/billing-address` | Prisma `billingAddress` upsert |
| `GET` | `billing-portal/organizations/:orgId/company-info` | `OrganizationsService.findById` |
| `PUT` | `billing-portal/organizations/:orgId/company-info` | `OrganizationsService.update` |
| `GET` | `billing-portal/organizations/:orgId/tax-info` | Prisma `organization` settings JSON |
| `PUT` | `billing-portal/organizations/:orgId/tax-info` | Prisma `organization.update` (settings JSON merge) |

## Audit Logging

All 4 subscription-changing operations record audit entries:

| Operation | Event | Severity |
|-----------|-------|----------|
| Upgrade | `subscription.plan.upgraded` | INFO |
| Downgrade | `subscription.plan.downgraded` | INFO |
| Cancel | `subscription.canceled` | WARN |
| Resume | `subscription.resumed` | INFO |

## Existing Services Reused (no duplication)

- `PaymentService` — CRUD, pagination, filtering
- `InvoiceService` — CRUD, pagination, filtering
- `CouponService` — validate, apply, calculate discounts
- `SubscriptionsService` — plans, subscription CRUD, lifecycle
- `SubscriptionService` — facade for lifecycle/resolver access
- `PlanResolver` — billing cycle, renewal date
- `FeatureResolver` — feature availability, locked features
- `UsageResolver` — usage counters, remaining limits
- `OrganizationsService` — org profile, company info
- `AuditLogService` — audit trail for subscription changes

## Test Coverage (17 tests)

| Category | Tests |
|----------|-------|
| Subscription | getCurrentSubscription, upgrade + audit, cancel + audit, resume + audit |
| Plans | comparePlans |
| Trial/Renewal | no trial, active trial, getUpcomingInvoice |
| Invoices | org match, org mismatch (throws) |
| Payments | org match, org mismatch (throws) |
| Billing Address | default found, fallback to any |
| Coupons | validate delegation |
| Features | locked features filtering |
| Tax Info | settings merge |

## Verification

```
npm run build      ✅
npm run lint       ✅
npm test           ✅ 28 suites, 353 tests
npx prisma validate ✅
```
