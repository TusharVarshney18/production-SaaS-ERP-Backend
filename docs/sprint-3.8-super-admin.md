# Sprint 3.8 — Super Admin Backend

## Summary

Created a comprehensive Super Admin backend module with global authorization, thin controllers, and reuse of all existing business services. A new `SuperAdminGuard` provides authentication + authorization via env-configured email allowlist.

## Files Created

| File | Purpose |
|------|---------|
| `src/super-admin/super-admin.module.ts` | Module importing Billing, Subscriptions, AuditLog, Organizations, RBAC |
| `src/super-admin/super-admin.controller.ts` | REST controller with 40+ endpoints, Swagger decorators |
| `src/super-admin/super-admin.service.ts` | Orchestration service — delegates to existing services |
| `src/super-admin/guards/super-admin.guard.ts` | Auth guard: extends `JwtAuthGuard` + checks `SUPER_ADMIN_EMAILS` env var |
| `src/super-admin/dto/super-admin-org-query.dto.ts` | Org query with search/status/plan/trial/filters + pagination |
| `src/super-admin/dto/change-org-plan.dto.ts` | Plan enum validated |
| `src/super-admin/dto/override-usage-limits.dto.ts` | softLimit/hardLimit |
| `src/super-admin/dto/override-feature-flags.dto.ts` | featureSlug, enabled, value |
| `src/super-admin/dto/duplicate-plan.dto.ts` | name?, slug? |
| `src/super-admin/dto/plan-pricing.dto.ts` | price, currency, trialPeriodDays, isActive |
| `src/super-admin/dto/create-announcement.dto.ts` | title, body, severity, startsAt, endsAt, isPublished |
| `src/super-admin/dto/update-system-setting.dto.ts` | key, value, description |
| `src/super-admin/__tests__/super-admin.service.spec.ts` | 11 unit tests |

## Files Modified

| File | Change |
|------|--------|
| `src/app.module.ts` | Added `SuperAdminModule` |
| `src/config/config.schema.ts` | Added `SUPER_ADMIN_EMAILS` (optional) |
| `.env.example` | Added `SUPER_ADMIN_EMAILS` |

## Architecture

```
SuperAdminGuard (JWT auth + email allowlist check)
        │
        ▼
SuperAdminController (thin, no business logic)
        │
        ▼
SuperAdminService (orchestration + audit logging)
        │
        ▼
   OrganizationsService | SubscriptionsService | PaymentService
   InvoiceService | CouponService | RbacService | AuditLogService
   FeatureResolver | UsageResolver | PrismaService (direct)
```

## Endpoints (40+)

### Dashboard (1)
| Method | Route |
|--------|-------|
| `GET` | `super-admin/dashboard/stats` |

### Organizations (9)
| Method | Route |
|--------|-------|
| `GET` | `super-admin/organizations` — list/search/filter |
| `GET` | `super-admin/organizations/:id` — details |
| `PATCH` | `super-admin/organizations/:id/suspend` |
| `PATCH` | `super-admin/organizations/:id/restore` |
| `DELETE` | `super-admin/organizations/:id` — soft delete |
| `PATCH` | `super-admin/organizations/:id/reactivate` |
| `PATCH` | `super-admin/organizations/:id/plan` — change plan |
| `PATCH` | `super-admin/organizations/:id/usage-limits` — override |
| `PATCH` | `super-admin/organizations/:id/features` — override flags |

### Plans (7)
| Method | Route |
|--------|-------|
| `POST` | `super-admin/plans` — create |
| `PATCH` | `super-admin/plans/:id` — update |
| `PATCH` | `super-admin/plans/:id/archive` |
| `PATCH` | `super-admin/plans/:id/restore` |
| `DELETE` | `super-admin/plans/:id` — soft delete |
| `POST` | `super-admin/plans/:id/duplicate` |
| `PATCH` | `super-admin/plans/:id/pricing` |

### Features (7)
| Method | Route |
|--------|-------|
| `POST` | `super-admin/features` — create |
| `PATCH` | `super-admin/features/:id` — update |
| `DELETE` | `super-admin/features/:id` — delete |
| `POST` | `super-admin/features/:featureId/assign/:planId` |
| `DELETE` | `super-admin/features/:featureId/remove/:planId` |
| `PATCH` | `super-admin/plan-features/:id/enable` |
| `PATCH` | `super-admin/plan-features/:id/disable` |

### Coupons (5)
| Method | Route |
|--------|-------|
| `GET` | `super-admin/coupons` — list all |
| `GET` | `super-admin/coupons/analytics` |
| `PATCH` | `super-admin/coupons/:id/disable` |
| `POST` | `super-admin/coupons/:id/expire` |
| `DELETE` | `super-admin/coupons/:id` |

### Payments (6)
| Method | Route |
|--------|-------|
| `GET` | `super-admin/payments` — all |
| `GET` | `super-admin/payments/failed` |
| `GET` | `super-admin/payments/refunded` |
| `GET` | `super-admin/payments/revenue` |
| `GET` | `super-admin/payments/mrr` |
| `GET` | `super-admin/payments/arr` |

### Invoices (2)
| Method | Route |
|--------|-------|
| `GET` | `super-admin/invoices` — all/search |
| `GET` | `super-admin/invoices/:id/download` |

### Announcements (3)
| Method | Route |
|--------|-------|
| `POST` | `super-admin/announcements` — create |
| `PATCH` | `super-admin/announcements/:id/publish` |
| `PATCH` | `super-admin/announcements/:id/schedule` |

### System Settings (2)
| Method | Route |
|--------|-------|
| `GET` | `super-admin/settings` — all grouped |
| `PUT` | `super-admin/settings` — upsert |

### Audit Logs (1)
| Method | Route |
|--------|-------|
| `GET` | `super-admin/audit-logs` — global search |

## Existing Services Reused (no duplication)

- `OrganizationsService` — CRUD, suspend, restore, delete
- `SubscriptionsService` — plan CRUD, subscription management
- `PaymentService` — payment queries with filters
- `InvoiceService` — invoice queries, detail, download
- `CouponService` — coupon CRUD, update
- `AuditLogService` — audit logging for all super admin actions
- `RbacService` — permission management
- `FeatureResolver` / `UsageResolver` — feature/usage lookups

## New Services (for previously unimplemented models)

Operations on `Announcement`, `SystemSetting`, `Feature`, `PlanFeature`, and `UsageCounter` models are performed directly via `PrismaService` in `SuperAdminService` — no separate service modules were created.

## Audit Logging

Every mutation endpoint records an audit log entry via `AuditLogService.create()`.

## Dashboard Statistics

Computed at query time from Prisma aggregations:
- Total/active/suspended organizations
- Organizations by plan
- Total/active users
- Payment counts (all, today, failed)
- Revenue totals, MRR, ARR

## Configuration

```
SUPER_ADMIN_EMAILS=admin@example.com,super@example.com
```

## Test Coverage (11 tests)

| Category | Tests |
|----------|-------|
| Organizations | list paginated, suspend + audit, soft delete |
| Features | create, assign to plan, duplicate assignment |
| Plans | duplicate |
| Revenue | aggregation, MRR calculation |
| Dashboard | multi-aggregation stats |
| Audit Logs | paginated search |

## Verification

```
npm run build      ✅
npm run lint       ✅
npm test           ✅ 29 suites, 364 tests
npx prisma validate ✅
```
