# ERPX — Backend Architecture

> **Last Updated:** 2026-07-09  
> **Version:** 1.0.0  
> **Classification:** Internal

---

## 1. Overview

ERPX is a multi-tenant SaaS enterprise resource platform built on NestJS with PostgreSQL. The backend follows a modular monolith architecture with service-oriented decomposition, designed to be extracted into microservices as the platform scales.

### Technology Stack

| Component | Technology |
|---|---|
| Framework | NestJS 10.x |
| Language | TypeScript 5.x |
| Database | PostgreSQL 16 via Prisma ORM 5.x |
| Authentication | JWT (access + refresh tokens) + Passport |
| Validation | class-validator + class-transformer |
| Documentation | Swagger/OpenAPI via `@nestjs/swagger` |
| Logging | Pino via `nestjs-pino` |
| Security | Helmet, CORS, Throttler, Compression |
| Payments | Razorpay SDK (Stripe planned) |

---

## 2. Module Architecture

```
src/
├── app.module.ts                  # Root module — imports all feature modules
├── main.ts                        # Bootstrap — pipes, filters, interceptors, Swagger
│
├── config/                        # Configuration (registerAs namespaces + Joi schema)
│   ├── config.schema.ts
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── jwt.config.ts
│   ├── redis.config.ts
│   └── razorpay.config.ts
│
├── prisma/                        # Global Prisma service
│   ├── prisma.module.ts           # @Global() — available to all modules
│   └── prisma.service.ts          # Extends PrismaClient
│
├── common/                        # Shared infrastructure
│   ├── middleware/
│   │   └── request-id.middleware.ts   # UUID per request, X-Request-Id header
│   ├── interceptors/
│   │   ├── transform.interceptor.ts   # { success, message, data, meta }
│   │   └── logging.interceptor.ts     # METHOD URL STATUS DURATION
│   └── filters/
│       └── all-exceptions.filter.ts   # Unified error response
│
├── auth/                          # Authentication module
│   ├── strategies/                # JWT strategy (Passport)
│   ├── guards/                    # JwtAuthGuard
│   ├── decorators/                # @CurrentUser() param decorator
│   ├── interfaces/                # JwtPayload
│   └── dto/                       # LoginDto, RegisterDto, RefreshDto
│
├── organizations/                 # Tenant management
│   ├── organizations.controller.ts
│   ├── organizations.service.ts
│   └── dto/
│
├── organization-settings/         # Tenant configuration
│   ├── organization-settings.controller.ts
│   ├── organization-settings.service.ts
│   └── dto/
│
├── rbac/                          # Roles and permissions
│   ├── rbac.controller.ts
│   ├── rbac.service.ts
│   └── dto/
│
├── authorization/                 # Permission guard
│   ├── decorators/                # @Permissions() metadata decorator
│   ├── guards/                    # PermissionGuard (uses Reflector)
│   └── authorization.service.ts
│
├── audit-log/                     # Append-only audit trail
│   ├── audit-log.controller.ts
│   ├── audit-log.service.ts
│   └── dto/
│
├── subscriptions/                 # Subscription engine (7 services)
│   ├── subscriptions.controller.ts    # REST endpoints (16 routes)
│   ├── subscriptions.service.ts       # Plan CRUD + lifecycle delegation
│   ├── subscription.service.ts         # Facade orchestrator
│   ├── subscription-lifecycle.service.ts   # State machine
│   ├── plan-resolver.service.ts        # Plan/billing cycle resolution
│   ├── feature-resolver.service.ts     # Feature flag queries
│   ├── usage-resolver.service.ts       # Usage limit enforcement
│   ├── entitlement.service.ts          # Unified authorization
│   └── dto/, interfaces/, __tests__/
│
└── billing/                       # Billing & payment domain (8 services)
    ├── billing.service.ts              # Facade
    ├── payment.service.ts              # Payment records CRUD
    ├── invoice.service.ts              # Invoice CRUD with auto-numbering
    ├── coupon.service.ts               # Coupon CRUD + validation
    ├── providers/
    │   ├── payment-gateway.interface.ts    # 4-method contract
    │   ├── payment-provider.factory.ts     # DI-based registry
    │   ├── razorpay/
    │   │   ├── razorpay.provider.ts        # Real SDK implementation
    │   │   ├── razorpay.dto.ts
    │   │   └── razorpay.types.ts
    │   └── stripe/
    │       ├── stripe.provider.ts          # Mock implementation
    │       └── stripe.dto.ts
    ├── services/
    │   └── payment-gateway.service.ts      # No hardcoded provider names
    └── dto/, interfaces/, __tests__/
```

---

## 3. Database Design

### Schema Overview

The database uses PostgreSQL 16 with the `@prisma/client` ORM. Key design decisions:

- **UUID primary keys** — prevent enumeration, enable distributed ID generation
- **snake_case** — table and column naming via `@@map()` and `@map()`
- **Soft deletes** — `deletedAt` + `deletedByUserId` + `deletedReason` on all major entities
- **Multi-tenancy** — all tenant-scoped models carry `organizationId` with composite indexes
- **Timestamps** — `createdAt` + `updatedAt` on every model
- **Metadata JSON** — flexible key-value storage on Payment, Invoice, and other entities

### Model Groups

**Platform/System** (no org scoping):
- `PermissionGroup`, `Permission`, `SystemSetting`, `Announcement`, `WebhookEvent`

**Tenant-scoped** (all carry `organizationId`):
- `Organization`, `OrganizationSettings`, `User`, `Session`, `RefreshToken`
- `Role`, `UserRole`, `RolePermission`
- `AuditLog`, `Notification`
- `SubscriptionPlan`, `OrganizationSubscription`, `Feature`, `PlanFeature`, `UsageCounter`
- `Payment`, `Invoice`, `Coupon`, `CouponUsage`, `PaymentMethod`, `BillingAddress`

### Subscription Status Machine

```
                    ┌─────────┐
                    │  TRIAL  │
                    └────┬────┘
                         │ activate
                    ┌────▼────┐
              ┌─────│  ACTIVE │──────┐
              │     └────┬────┘      │
        period end  ┌───▼───┐   cancel
              │      │ GRACE │      │
              │      └───┬───┘      │
              │   grace ┌──▼──┐     │
              ├────────►│PAST │     │
              │   end   │ DUE │     │
              │         └──┬──┘     │
              │      suspend │      │
              │       ┌─────▼──────┐│
              └──────►│ SUSPENDED  ││
                      └─────┬──────┘│
                            │       │
                      ┌─────▼───────▼──┐
                      │   CANCELED     │
                      └───────┬────────┘
                              │
                      ┌───────▼────────┐
                      │   EXPIRED      │
                      └────────────────┘
```

Transitions are enforced by the `VALID_TRANSITIONS` map in `subscriptions/interfaces/lifecycle.interface.ts`.

---

## 4. API Design

### Conventions

- **Base path:** `/api/v1/`
- **Versioning:** URI-based (`/api/v1/`, future `/api/v2/`)
- **Auth:** Bearer JWT tokens via `JwtAuthGuard`
- **Authorization:** `@Permissions()` decorator + `PermissionGuard`
- **Responses:** Wrapped in `{ success, message, data, meta }` via `TransformInterceptor`
- **Errors:** Unified `{ success, message, errors, requestId, timestamp }` via `AllExceptionsFilter`
- **Pagination:** Cursor-based with `{ data, meta: { total, page, limit, totalPages } }`

### Module Endpoints

| Module | Prefix | Auth | Endpoints |
|---|---|---|---|
| Auth | `/api/v1/auth` | Public/Protected | register, login, refresh, logout, me |
| Organizations | `/api/v1/organizations` | JWT | CRUD + soft-delete/restore |
| Organization Settings | `/api/v1/organizations/:id/settings` | JWT | Get, Update |
| RBAC | `/api/v1/organizations/:orgId/roles` | JWT + Permissions | CRUD, assign, remove, update permissions |
| Audit Logs | `/api/v1/organizations/:orgId/audit-logs` | JWT | List with filters |
| Subscriptions | `/api/v1/subscriptions` | JWT | Plan CRUD, subscription lifecycle, features, usage |
| Billing | (via PaymentGatewayService) | JWT | Checkout, verify, refund, webhook |

### Rate Limiting

- **Global:** 100 requests per 60 seconds per IP (ThrottlerGuard)
- **Per-endpoint:** Configured via `@Throttle()` decorator where needed

---

## 5. Payment Gateway Architecture

### Interface

```typescript
interface PaymentGateway {
  readonly name: string;
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse>;
  verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResponse>;
  refund(params: RefundParams): Promise<RefundResponse>;
  handleWebhook(payload: WebhookPayload): Promise<WebhookHandlerResponse>;
}
```

### Provider Selection Flow

```
PaymentGatewayService.createCheckout(request)
  → request.provider = "razorpay"          // No hardcoded names
  → PaymentProviderFactory.getProvider("razorpay")
  → Returns RazorpayProvider instance
  → RazorpayProvider.createCheckout(params)
  → Returns provider-independent CheckoutResponse
```

### Registration

All providers are registered in `BillingModule.onModuleInit()`:
```typescript
this.factory.register('razorpay', this.razorpayProvider);
this.factory.register('stripe', this.stripeProvider);
```

---

## 6. Security Architecture

### Authentication
- JWT access tokens (15 min TTL) + refresh tokens (7 day TTL) with rotation
- OAuth2.0 ready for social login
- MFA via TOTP (configurable per org — planned)

### Authorization
- RBAC with pre-defined roles: Owner, Admin, Member, Viewer
- Custom roles for Business+ plans
- Permission-based endpoint guards via `@Permissions()` decorator

### Tenant Isolation
- **Row-level:** All queries scoped by `organizationId`
- **Cache:** Redis keys prefixed with organization ID
- **File storage:** S3 paths prefixed with organization ID
- **Future:** Schema-per-tenant for Enterprise tier

### Data Protection
- Encryption at rest (AES-256) via PostgreSQL
- Encryption in transit (TLS 1.3)
- Passwords hashed with bcrypt (cost factor 12) via Argon2
- API keys encrypted with AES-256-GCM
- PII masked in logs

---

## 7. Subscription Engine

### Service Responsibilities

| Service | Role | Dependencies |
|---|---|---|
| `SubscriptionsService` | Plan CRUD + lifecycle delegation | Prisma, SubscriptionLifecycleService |
| `SubscriptionService` | Facade | lifecycle, plan, features, usage |
| `SubscriptionLifecycleService` | State machine transitions | Prisma |
| `PlanResolver` | Plan/billing cycle resolution | Prisma |
| `FeatureResolver` | Feature flag queries | Prisma |
| `UsageResolver` | Usage tracking + limit enforcement | Prisma, FeatureResolver |
| `EntitlementService` | Unified authorization | FeatureResolver, UsageResolver |

### Entitlement Flow

```
EntitlementService.can(orgId, featureSlug)
  ├── FeatureResolver.hasFeature() → false → { allowed: false, reason: "upgrade" }
  └── FeatureResolver.hasFeature() → true
        └── UsageResolver.canUse() → blocked → { allowed: false, reason: "limit" }
        └── UsageResolver.canUse() → allowed → { allowed: true, reason: null }
```

---

## 8. Testing Strategy

- **Unit tests:** Jest with `jest-mock-extended` for Prisma mocking
- **Service tests:** Mock PrismaService at the repository level
- **Controller tests:** NestJS `Test.createTestingModule` with mocked services
- **Coverage:** All services and controllers have comprehensive unit tests
- **Current total:** 291 tests across 27 suites

---

## 9. Configuration

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `JWT_ACCESS_SECRET` | JWT signing key (min 32 chars) | Yes |
| `JWT_ACCESS_EXPIRATION` | Access token TTL | No (default: 15m) |
| `JWT_REFRESH_EXPIRATION` | Refresh token TTL | No (default: 7d) |
| `REDIS_URL` | Redis connection | No |
| `CORS_ORIGIN` | Allowed CORS origin | No (default: localhost:5173) |
| `RAZORPAY_KEY_ID` | Razorpay API key | No |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret | No |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret | No |
