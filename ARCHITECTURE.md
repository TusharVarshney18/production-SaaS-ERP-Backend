# ERPX Backend Architecture — SaaS Platform Blueprint

> Version 2.0 — Milestone 3B+ Architecture
> This document is the official architecture blueprint for the ERPX SaaS Platform.
> No code should be written without referencing this document first.

---

## Table of Contents

1. [Subscription Plans](#1-subscription-plans)
2. [Feature Flag System](#2-feature-flag-system)
3. [Usage Limit System](#3-usage-limit-system)
4. [Billing Architecture](#4-billing-architecture)
5. [Notification Architecture](#5-notification-architecture)
6. [Super Admin Architecture](#6-super-admin-architecture)
7. [Customer Dashboard](#7-customer-dashboard)
8. [AI Platform](#8-ai-platform)
9. [API Design](#9-api-design)
10. [Recommended Folder Structure](#10-recommended-folder-structure)
11. [Database Design](#11-database-design)
12. [Security Considerations](#12-security-considerations)

---

## 1. Subscription Plans

### 1.1 Plan Catalog

| Plan | Slug | Target | Billing | Key Differentiator |
|------|------|--------|---------|-------------------|
| **Free** | `free` | Micro business / trial | None | Core features with limits |
| **Growth** | `growth` | Small business | Monthly / Yearly | Team collaboration + AI |
| **Business** | `business` | Mid-market | Monthly / Yearly | Full feature set + priority |
| **Enterprise** | `enterprise` | Large org | Monthly / Yearly / Custom | White-label, SLA, dedicated |
| **Custom** | (dynamic) | Wholesale / special | Negotiated | Tailored feature bundles |

### 1.2 Plan Data Model

Stored in `SubscriptionPlan` (already in Prisma schema):

```
SubscriptionPlan {
  id              String  PK
  name            String          "Free", "Growth", etc.
  slug            String  UNIQUE  "free", "growth", etc.
  description     String?
  billingInterval BillingInterval MONTHLY | YEARLY
  price           Int             In smallest currency unit (cents/paise)
  currency        String          "USD", "INR"
  trialPeriodDays Int
  isActive        Boolean
  sortOrder       Int
  softDeletes     (deletedAt, deletedByUserId, deletedReason)
  timestamps      createdAt, updatedAt

  Relations:
    features      PlanFeature[]
    subscriptions OrganizationSubscription[]
}
```

### 1.3 Plan Hierarchy Rules

- **Free** is always available at registration.
- **Growth / Business / Enterprise** are upgrade paths — never downgrade without data migration.
- **Custom** is created by Super Admin and assigned ad-hoc.
- Plan changes take effect at next billing period unless immediate switch is requested.
- Down-grading restricts feature access but does **not** delete data (data is hidden, restorable on re-upgrade).

### 1.4 Pricing Strategy

- All prices stored in smallest currency unit (e.g., USD cents, INR paise).
- Annual billing offers a discount percentage stored per-plan.
- Promo/coupon pricing overrides plan price for a duration.

---

## 2. Feature Flag System

### 2.1 Feature Model

Already in Prisma schema:

```
Feature {
  id          String  PK
  name        String          "Invoice Export"
  slug        String  UNIQUE  "invoice_export"
  description String?
  group       String          "billing", "ai", "import", "admin"
  isActive    Boolean
  softDeletes (deletedAt, deletedByUserId, deletedReason)
  timestamps  createdAt, updatedAt

  Relations:
    plans         PlanFeature[]
    usageCounters UsageCounter[]
}
```

### 2.2 Plan-Feature Assignment

Junction table `PlanFeature`:

```
PlanFeature {
  id          String  PK
  planId      String  FK -> SubscriptionPlan
  featureId   String  FK -> Feature
  value       String  Default "true" — "true", "false", or a numeric limit
  isAvailable Boolean Default true
}
```

### 2.3 Feature Resolution Algorithm (Service Layer)

```
function isFeatureAvailable(organizationId, featureSlug):
  1. Lookup org's current SubscriptionPlan via OrganizationSubscription
  2. Find Feature by slug
  3. Check PlanFeature junction: isAvailable && value !== "false"
  4. If value is numeric, cross-reference UsageCounter
  5. Return boolean + limit info
```

### 2.4 Feature Groups

| Group | Example Features |
|-------|-----------------|
| `core` | Invoice, Product, Lead management |
| `ai` | AI Assistant, Smart Column Mapping, OCR |
| `import` | Excel/CSV Import, PDF Import, Preview |
| `export` | PDF Export, Excel Export |
| `collaboration` | Multi-user, Role management |
| `admin` | Audit Logs, Organization Settings |
| `billing` | Invoicing, Payment Links |
| `api` | API Access, Webhooks |
| `support` | Priority Support, SLA |

### 2.5 Feature Caching

Feature flag results should be cached per-org with a TTL of 5 minutes.
Cache is invalidated when:
- Plan changes
- Feature is toggled by Super Admin
- Usage limit is exceeded

---

## 3. Usage Limit System

### 3.1 UsageCounter Model

Already in Prisma schema:

```
UsageCounter {
  id              String  PK
  organizationId  String  FK
  featureId       String  FK
  period          String  "2026-07" (YYYY-MM format)
  usage           Int     Current count
  softLimit       Int?    Warning threshold
  hardLimit       Int?    Hard cap (null = unlimited)

  Unique: [organizationId, featureId, period]
}
```

### 3.2 Usage Tracking Pattern

```
function incrementUsage(organizationId, featureSlug, amount = 1):
  1. Compute period key (YYYY-MM for monthly, YYYY for yearly)
  2. Upsert UsageCounter
     - On create: usage = amount
     - On update: usage += amount
  3. After increment, check:
     - If softLimit reached → emit notification (warning)
     - If hardLimit reached → block action, return error
```

### 3.3 Usage Limit Tiers

| Feature | Free | Growth | Business | Enterprise |
|---------|------|--------|----------|-----------|
| Invoices/month | 10 | 500 | 5000 | Unlimited |
| Products | 25 | 1000 | 10000 | Unlimited |
| Leads | 25 | 500 | 5000 | Unlimited |
| Team members | 1 | 5 | 25 | Unlimited |
| AI queries/day | 0 | 50 | 500 | Custom |
| Storage (MB) | 50 | 500 | 5000 | Custom |
| API calls/hour | 100 | 1000 | 10000 | Custom |

### 3.4 Soft vs Hard Limits

- **Soft limit**: Organization admin sees a warning banner; feature still works.
- **Hard limit**: Feature is blocked; user sees a clear error message with upgrade CTA.
- Soft and hard limits are defined in `PlanFeature.value` as JSON: `{"soft": 450, "hard": 500}`.

### 3.5 Reset Strategy

- Monthly counters reset on the first day of each month.
- Yearly counters reset on the anniversary of subscription start.
- Usage data is retained for 12 months for analytics.

---

## 4. Billing Architecture

### 4.1 Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Billing Module                        │
├─────────────────────────────────────────────────────────┤
│  PaymentProvider (abstract)                             │
│    ├── StripeProvider                                    │
│    └── RazorpayProvider                                  │
│                                                         │
│  Services:                                               │
│    ├── SubscriptionService    (plan changes, renewals)   │
│    ├── InvoiceService         (billing invoices)         │
│    ├── CouponService          (discounts, promos)        │
│    ├── TrialService           (trial management)         │
│    └── WebhookService         (provider callbacks)       │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Payment Provider Abstraction

```typescript
interface PaymentProvider {
  createCustomer(org): CustomerResult;
  createSubscription(org, plan, coupon?): SubscriptionResult;
  cancelSubscription(subscriptionId): void;
  updateSubscription(subscriptionId, newPlanId): void;
  generateInvoice(org, items): InvoiceResult;
  createPaymentLink(amount, description): PaymentLinkResult;
  refund(paymentId, amount?): RefundResult;
  handleWebhook(payload, signature): WebhookEvent;
}
```

### 4.3 Stripe Integration

- Uses Stripe's `subscriptions` API for recurring billing.
- Webhooks: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Idempotency keys on all mutation requests.
- Prices stored as Stripe Price IDs mapped to `SubscriptionPlan` via a `providerPriceId` field.

### 4.4 Razorpay Integration

- Uses Razorpay's `subscriptions` API.
- Webhooks: `subscription.charged`, `subscription.pending`, `subscription.halted`, `invoice.paid`.
- Razorpay-specific: handles Indian Rupee (INR), supports UPI/Netbanking/Cards.
- Razorpay offers `payment_link` API for one-time invoicing.

### 4.5 Coupon System

```
Coupon {
  id              String  PK
  code            String  UNIQUE  "LAUNCH20"
  description     String?
  discountType    DISCOUNT_TYPE  PERCENTAGE | FIXED_AMOUNT
  discountValue   Int            Percentage (10) or amount (500)
  maxRedemptions  Int?
  currentRedemptions Int
  validFrom       DateTime
  validUntil      DateTime?
  appliesToPlanId String?         FK -> SubscriptionPlan (null = all)
  isActive        Boolean

  timestamps      createdAt, updatedAt
}
```

- Coupons are applied at checkout or entered via a coupon code field.
- Coupons can be limited to specific plans or specific organizations.
- Redemption tracking prevents reuse beyond `maxRedemptions`.

### 4.6 Trial Management

- Free plan has indefinite trial with usage limits.
- Paid plans have a plan-specific `trialPeriodDays`.
- Trial starts when a non-free plan is first selected.
- Trial end is tracked in `OrganizationSubscription.trialEndsAt`.
- During trial: full feature access of the selected plan.
- After trial: auto-convert to paid, or downgrade to Free.
- Reminder emails: 7 days, 3 days, 1 day before trial end.

### 4.7 Renewal Flow

```
Subscription Renewal:
  1. Cron job runs daily, queries subscriptions ending in 7 days
  2. Payment provider charges the saved payment method
  3. On success:
     - Update currentPeriodStart/End
     - Send "Invoice paid" notification
  4. On failure:
     - Retry after 3 days (dunning)
     - Retry after 7 days (final notice)
     - After final failure: pause subscription, downgrade to Free
     - Send "Payment failed" notification
```

### 4.8 Billing Invoices

- Invoice generated on every successful payment event (webhook).
- Invoice stored locally with provider payment reference.
- Customer can view/download invoices from the dashboard.
- Invoice PDF is generated server-side and stored in S3 (or equivalent).

### 4.9 Webhook Handling

```
Webhook Processing:
  1. Receive POST from provider
  2. Verify signature (Stripe HMAC, Razorpay webhook secret)
  3. Idempotency check (deduplicate by event ID)
  4. Process event asynchronously (queue via Bull/BullMQ)
  5. Update local database
  6. Return 200 OK
  7. On failure: log, retry queue up to 3 times, alert admin
```

---

## 5. Notification Architecture

### 5.1 Channel Strategy

| Channel | Status | Priority | Volume |
|---------|--------|----------|--------|
| **Email** | Active | High | Transactional |
| **In-app** | Active | Medium | All events |
| **Push** | Future | Low | Digest + alerts |
| **WhatsApp** | Future | Low | Critical only |

### 5.2 Notification Model

```
Notification {
  id              String  PK
  organizationId  String  FK
  userId          String? FK  (null = org-wide broadcast)
  type            String        "invoice.overdue", "trial.ending", etc.
  title           String
  body            String?
  data            Json?         Payload for rendering
  channel         String        "email" | "in_app" | "push" | "whatsapp"
  status          String        "pending" | "sent" | "failed" | "read"
  isRead          Boolean
  readAt          DateTime?
  sentAt          DateTime?
  softDeletes     (deletedAt, deletedByUserId, deletedReason)
  timestamps      createdAt, updatedAt
}
```

### 5.3 In-App Notification System

- Notifications are stored in DB and fetched via a `GET /notifications` endpoint.
- Real-time delivery via WebSocket (Socket.IO or native WebSockets).
- Unread count badge via `GET /notifications/unread-count`.
- Mark-as-read and mark-all-as-read endpoints.
- Notifications are paginated (reverse chronological).
- Retention: 90 days for Free/Growth, 180 days for Business, 365 days for Enterprise.

### 5.4 Email Notification System

- Use a transactional email service (Resend / SendGrid / AWS SES).
- Email templates stored in a `templates/` directory (handlebars or React-Email).
- Template variables populated from `Notification.data`.
- Sender email: `noreply@erpx.app` (configurable per tenant for Enterprise).
- Queued delivery via Bull/BullMQ to avoid blocking the request cycle.
- Bounce and complaint handling via webhook from the email provider.

### 5.5 Notification Event Catalog

| Event | In-App | Email | Push | WhatsApp |
|-------|--------|-------|------|----------|
| `user.welcome` | Yes | Yes | No | No |
| `user.invited` | Yes | Yes | No | No |
| `subscription.trial_ending` | Yes | Yes | No | Future |
| `subscription.renewed` | Yes | Yes | No | No |
| `subscription.payment_failed` | Yes | Yes | Yes | Future |
| `subscription.expired` | Yes | Yes | No | No |
| `usage.soft_limit_reached` | Yes | No | No | No |
| `usage.hard_limit_reached` | Yes | Yes | No | No |
| `invoice.created` | Yes | Yes | No | No |
| `invoice.overdue` | Yes | Yes | No | Future |
| `role.assigned` | Yes | No | No | No |
| `system.announcement` | Yes | Optional | No | No |
| `ai.import_complete` | Yes | No | Yes | No |
| `ai.import_failed` | Yes | No | Yes | No |

### 5.6 Notification Preferences

- Per-user opt-out per notification type.
- Per-user channel preferences (some users only want in-app, others want email).
- Super Admin can force-send critical notifications regardless of preferences.

### 5.7 Architecture Diagram

```
┌──────────┐    ┌─────────────┐    ┌──────────────┐
│  Action   │───▶│ Notification │───▶│  Dispatcher  │
│ (Service) │    │   Service    │    │              │
└──────────┘    └─────────────┘    └──────┬───────┘
                                          │
                          ┌───────────────┼───────────────┐
                          ▼               ▼               ▼
                    ┌──────────┐   ┌──────────┐   ┌──────────┐
                    │  Email   │   │ In-App   │   │  Queue   │
                    │ Provider │   │ (Direct) │   │ (Future) │
                    └──────────┘   └──────────┘   └──────────┘
```

---

## 6. Super Admin Architecture

### 6.1 Super Admin vs Organization Admin

| Aspect | Super Admin | Org Admin |
|--------|------------|-----------|
| Scope | System-wide | Single org |
| Access | Dedicated admin panel | App dashboard |
| Auth | Separate login or JWT role check | Regular JWT |
| Data isolation | All orgs | Own org only |

### 6.2 Super Admin Implementation Options

**Option A (Recommended): Super Admin Role + Guard**
- A special `super_admin` role flagged in the `User` model or a dedicated flag.
- A `SuperAdminGuard` that checks `user.isSuperAdmin` or a specific permission.
- Existing auth system reused; no separate login required.
- Routes gated by both `JwtAuthGuard` and `SuperAdminGuard`.

**Option B: Dedicated Admin App**
- Separate NestJS module at `/api/v1/admin/...`.
- Separate frontend application.
- Own authentication with stronger MFA requirements.

### 6.3 Super Admin Dashboard Modules

| Module | Purpose | Key Metrics |
|--------|---------|-------------|
| **Dashboard** | Overview | Total orgs, active users, MRR, churn rate |
| **Organizations** | Org management list | Plan breakdown, status, creation date |
| **Plans** | CRUD plans + features | Active subscribers per plan |
| **Feature Management** | Toggle features globally | Feature adoption rates |
| **Usage Analytics** | Cross-org usage | Peak usage, top features, bottlenecks |
| **Revenue** | Financial reporting | MRR, ARR, refunds, failed payments |
| **Billing** | Invoices, payments, refunds | Pending payments, overdue invoices |
| **Support** | Support ticket viewer | Open tickets, response time |
| **Audit Logs** | Cross-org audit trail | Security events, unusual activity |
| **System Settings** | Global config | 2FA enforcement, rate limits |

### 6.4 Super Admin Route Structure

```
/admin/dashboard              — Overview metrics
/admin/organizations          — List all orgs (paginated, filterable)
/admin/organizations/:id      — Org detail with usage/activity
/admin/plans                  — Manage subscription plans
/admin/plans/:id/features     — Assign features to plan
/admin/features               — Feature flag management
/admin/usage                  — Cross-org usage analytics
/admin/revenue                — Revenue dashboard
/admin/billing/invoices       — All invoices
/admin/billing/coupons        — Coupon management
/admin/audit-logs             — System-wide audit trail
/admin/settings               — System settings (key-value)
```

### 6.5 Audit Trail for Super Admin

Every super admin action must be logged to the Audit Log with:
- `actorType: SYSTEM` (or a dedicated super admin type)
- `actorId` = super admin user ID
- `event` = `admin.*` prefix (e.g., `admin.org.suspend`)
- Full `details` JSON of the change

---

## 7. Customer Dashboard

### 7.1 Dashboard Areas

| Area | Description |
|------|-------------|
| **Overview** | Quick stats: invoices, products, leads, team |
| **Usage** | Usage meters with progress bars (current period) |
| **Billing** | Current plan, payment method, invoice history |
| **Team** | Member list with roles, invite new members |
| **Settings** | Org profile, preferences, security |
| **API** | API keys, usage, documentation |
| **Activity** | Recent activity log (filterable) |

### 7.2 Usage Meter Component

Each meter displays:
- Feature name and icon
- Current usage / limit (e.g., 47 / 500 invoices)
- Visual progress bar (green < 70%, yellow < 90%, red >= 90%)
- "Upgrade" CTA when hard limit is near or reached

### 7.3 Billing Dashboard

```
Billing Dashboard:
  ├── Current Plan Card
  │   ├── Plan name + logo
  │   ├── Price + billing interval
  │   ├── Days remaining in period
  │   └── "Change Plan" / "Cancel" buttons
  ├── Payment Method Card
  │   ├── Card type + last 4 digits
  │   ├── Expiry date
  │   └── "Update" button
  ├── Invoice History Table
  │   ├── Date, amount, status, download link
  │   └── Paginated
  └── Coupon / Promo Code Input
```

### 7.4 API Keys Management

- Each organization can generate multiple API keys.
- Keys are hashed on storage (like refresh tokens), only shown once on creation.
- Scoped to specific permissions (read-only, full access, etc.).
- Revocation support with immediate effect.
- Last used timestamp for auditing.

---

## 8. AI Platform

### 8.1 Architecture

```
┌────────────────────────────────────────────────────┐
│                   AI Module                          │
├────────────────────────────────────────────────────┤
│  Services:                                          │
│    ├── AiAssistantService        (chat, NL queries) │
│    ├── ImportService                               │
│    │   ├── ExcelImportService    (.xlsx, .csv)      │
│    │   ├── PdfImportService      (.pdf)             │
│    │   └── OcrService            (scanned docs)     │
│    ├── MappingService            (column mapping)   │
│    ├── DuplicateDetectionService                    │
│    ├── ValidationService         (data validation)  │
│    └── PreviewService            (preview before    │
│                                   import)           │
├────────────────────────────────────────────────────┤
│  External:                                          │
│    ├── OpenAI / Anthropic (LLM)                    │
│    ├── Tesseract / Google Vision (OCR)              │
│    └── LangChain (orchestration)                    │
└────────────────────────────────────────────────────┘
```

### 8.2 AI Assistant

- Conversational interface for natural language queries.
- Examples: "Show me unpaid invoices from last month", "Create a new product called Widget X with price $99".
- Uses LLM (GPT-4 or Claude) with function calling to execute operations.
- Conversation context is maintained per-session.
- Rate-limited per org (based on plan).

```
NL Query Flow:
  1. User sends natural language text
  2. System prompt + conversation history sent to LLM
  3. LLM responds with structured action or answer
  4. If action: validate + execute via service layer
  5. If question: query database via generated filters
  6. Response rendered back to user
```

### 8.3 AI Excel/CSV Import

```
Import Flow:
  1. User uploads file (.xlsx, .csv, .ods)
  2. File parsed — headers + sample rows extracted
  3. Smart Column Mapping:
     - AI analyzes header names and sample values
     - Auto-maps to entity fields (Invoice/Product/Lead)
     - User can review and adjust mapping
  4. Duplicate Detection:
     - Check existing data for duplicates (by email, name, etc.)
     - Flag and group potential duplicates
  5. Validation:
     - Type checking (number, date, email, etc.)
     - Required field presence
     - Reference validity (customer IDs, product codes)
     - Custom validation rules per entity
  6. Preview:
     - Show first 10 rows with mapping highlighted
     - Show error/warning count
     - Summary: N new, M duplicates, K errors
  7. Import:
     - Process in batches of 100 records
     - Transactional: rollback on critical error
     - Report: success count, error details per row
```

### 8.4 PDF Import

- Parse PDF invoices/purchase orders from vendors.
- Use OCR for scanned documents (Tesseract or Google Document AI).
- Extract structured fields: invoice number, date, vendor, line items, totals.
- Map extracted data to the appropriate entity.
- Follows the same validation → preview → import pipeline as Excel.

### 8.5 Smart Column Mapping

- Uses LLM to analyze column headers against known entity fields.
- Maintains a per-org mapping cache (learns from previous imports).
- Fallback to fuzzy string matching when AI is unavailable.
- User can save mappings as templates for recurring imports.

### 8.6 Natural Language Commands

- Beyond the AI Assistant, NL commands can be embedded inline.
- Example: User types `@create lead "Acme Corp" from john@acme.com` in a text field.
- Parsed client-side or server-side with regex + AI fallback.
- Supports quick-create for Leads, Invoices, Products, and Tasks.

---

## 9. API Design

### 9.1 URL Convention

```
/api/v1/{resource}[/{id}][/{sub-resource}[/{sub-id}]]

Examples:
  GET    /api/v1/organizations
  GET    /api/v1/organizations/:id
  PATCH  /api/v1/organizations/:id/settings
  GET    /api/v1/rbac/roles
  POST   /api/v1/rbac/roles
  POST   /api/v1/rbac/users/:userId/roles
  GET    /api/v1/audit-logs?event=user.login&page=1&limit=50
  GET    /api/v1/notifications
  POST   /api/v1/billing/subscriptions
  POST   /api/v1/billing/coupons/apply
  POST   /api/v1/ai/import/preview
  POST   /api/v1/ai/import/execute
  POST   /api/v1/ai/assistant/query
  GET    /api/v1/admin/organizations
```

### 9.2 Response Format

**Success:**
```json
{
  "success": true,
  "message": "",
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["email must be a valid email", "password must be at least 8 characters"],
  "requestId": "req-uuid",
  "timestamp": "2026-07-07T12:00:00.000Z"
}
```

### 9.3 Pagination

- Always use `page` and `limit` query parameters.
- Default: `page=1`, `limit=20`.
- Maximum limit: 200 (hard-capped).
- Response includes `meta` object with total, page, limit, totalPages.
- Cursor-based pagination for high-volume endpoints (audit logs, notifications).

### 9.4 Filtering & Sorting

- Filters via query parameters: `?status=ACTIVE&plan=FREE`.
- Range filters: `?createdAt[gte]=2026-01-01&createdAt[lte]=2026-12-31`.
- Sorting: `?sortBy=createdAt&sortOrder=desc`.
- Full-text search: `?search=acme` (implementation: `ILIKE` or full-text search index).

### 9.5 Rate Limiting

| Tier | Rate Limit (per IP/API key) |
|------|----------------------------|
| Free | 60 requests/minute |
| Growth | 300 requests/minute |
| Business | 1000 requests/minute |
| Enterprise | Custom |

Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### 9.6 API Key Authentication (Future)

- API keys are an alternative to JWT for machine-to-machine access.
- Passed via `X-API-Key` header.
- Scoped to specific permissions.
- Rate-limited per key.

### 9.7 Idempotency

- POST/PATCH/PUT endpoints should support `Idempotency-Key` header.
- Idempotency keys expire after 24 hours.
- Response cached for the key: if same key received, return cached response.
- Critical for payment and import endpoints.

### 9.8 Webhook API

- Organizations can register webhook endpoints.
- Events are sent via POST with HMAC signature.
- Retry with exponential backoff (3 attempts).
- Webhook logs viewable in the dashboard.

---

## 10. Recommended Folder Structure

```
src/
├── main.ts                          # Entry point
├── app.module.ts                    # Root module
│
├── auth/                            # Authentication (existing)
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── dto/
│   ├── guards/
│   ├── decorators/
│   ├── strategies/
│   ├── interfaces/
│   └── __tests__/
│
├── common/                          # Shared infrastructure (existing)
│   ├── middleware/
│   ├── filters/
│   ├── interceptors/
│   └── guards/
│
├── config/                          # Env config (existing)
│
├── prisma/                          # Prisma service (existing)
│
├── health/                          # Health checks (existing)
│
├── organizations/                   # Organization CRUD (done)
│
├── organization-settings/           # Org settings (done)
│
├── rbac/                            # Roles & permissions (done)
│
├── authorization/                   # Authorization service + guard (done)
│
├── audit-log/                       # Audit trail (done)
│
├── users/                           # User management
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── dto/
│   └── __tests__/
│
├── billing/                         # Billing module
│   ├── billing.module.ts
│   ├── billing.controller.ts
│   ├── billing.service.ts
│   ├── providers/
│   │   ├── payment-provider.interface.ts
│   │   ├── stripe.provider.ts
│   │   └── razorpay.provider.ts
│   ├── dto/
│   ├── webhooks/
│   │   ├── stripe.webhook.controller.ts
│   │   └── razorpay.webhook.controller.ts
│   └── __tests__/
│
├── subscriptions/                   # Subscription management
│   ├── subscriptions.module.ts
│   ├── subscriptions.service.ts
│   ├── dto/
│   └── __tests__/
│
├── features/                        # Feature flags
│   ├── features.module.ts
│   ├── features.service.ts
│   └── __tests__/
│
├── usage/                           # Usage tracking
│   ├── usage.module.ts
│   ├── usage.service.ts
│   ├── usage.interceptor.ts
│   └── __tests__/
│
├── notifications/                   # Notification system
│   ├── notifications.module.ts
│   ├── notifications.controller.ts
│   ├── notifications.service.ts
│   ├── dispatchers/
│   │   ├── email.dispatcher.ts
│   │   ├── in-app.dispatcher.ts
│   │   └── push.dispatcher.ts (future)
│   ├── templates/
│   │   ├── welcome.email.ts
│   │   ├── trial-ending.email.ts
│   │   └── ...
│   ├── dto/
│   └── __tests__/
│
├── admin/                           # Super Admin module
│   ├── admin.module.ts
│   ├── admin.controller.ts
│   ├── admin.service.ts
│   ├── guards/
│   │   └── super-admin.guard.ts
│   └── __tests__/
│
├── ai/                              # AI Platform
│   ├── ai.module.ts
│   ├── ai-assistant/
│   │   ├── ai-assistant.controller.ts
│   │   ├── ai-assistant.service.ts
│   │   └── prompts/
│   ├── import/
│   │   ├── import.controller.ts
│   │   ├── import.service.ts
│   │   ├── excel-import.service.ts
│   │   ├── pdf-import.service.ts
│   │   ├── ocr.service.ts
│   │   ├── mapping.service.ts
│   │   ├── duplicate-detection.service.ts
│   │   ├── validation.service.ts
│   │   └── preview.service.ts
│   └── __tests__/
│
├── dashboard/                       # Customer dashboard API
│   ├── dashboard.module.ts
│   ├── dashboard.controller.ts
│   └── dashboard.service.ts
│
└── queue/                           # Job queue (Bull/BullMQ)
    ├── queue.module.ts
    ├── queue.service.ts
    └── processors/
        ├── email.processor.ts
        ├── import.processor.ts
        └── billing.processor.ts

└── common/
    ├── decorators/                  # Shared decorators
    ├── pipes/                       # Custom pipes
    ├── utils/                       # Utility functions
    └── types/                       # Shared TypeScript types
```

### 10.1 Module Independence Rules

- Each module is self-contained with its own controller, service, DTOs, and tests.
- Modules communicate through service classes (importing the provider), not through the database directly.
- Cross-cutting concerns (logging, audit, usage tracking) are handled via interceptors, not embedded in services.
- `PrismaModule` is `@Global()` — injected directly, no need to import.

### 10.2 File Naming Conventions

- Files: `kebab-case` (e.g., `excel-import.service.ts`)
- Classes: `PascalCase` (e.g., `ExcelImportService`)
- DTOs: `{Entity}{Action}.dto.ts` (e.g., `CreateInvoiceDto`)
- Tests: `{filename}.spec.ts` (co-located in `__tests__/`)

---

## 11. Database Design

### 11.1 Existing Schema (Milestone 1-3A)

Already in Prisma schema (16 models):
- Organization, OrganizationSettings, User, Role, PermissionGroup, Permission
- UserRole, RolePermission, Session, RefreshToken
- AuditLog, SubscriptionPlan, Feature, PlanFeature
- OrganizationSubscription, UsageCounter
- Notification, Announcement, SystemSetting

### 11.2 New Models Required for Sprint 3+

**Coupon:**
```
Coupon {
  id                  String  PK
  code                String  UNIQUE
  description         String?
  discountType        DiscountType  PERCENTAGE | FIXED_AMOUNT
  discountValue       Int
  maxRedemptions      Int?     null = unlimited
  currentRedemptions  Int      default 0
  minAmount           Int?     Minimum purchase amount
  validFrom           DateTime
  validUntil          DateTime?
  appliesToPlanId     String?  FK -> SubscriptionPlan
  isActive            Boolean  default true
  timestamps          createdAt, updatedAt
}
```

**BillingInvoice:**
```
BillingInvoice {
  id                String  PK
  organizationId    String  FK
  subscriptionId    String? FK -> OrganizationSubscription
  provider          PaymentProvider  STRIPE | RAZORPAY
  providerInvoiceId String?          Provider's invoice ID
  providerPaymentId String?          Provider's payment ID
  amount            Int              Smallest currency unit
  currency          String
  status            InvoiceStatus    PAID | UNPAID | OVERDUE | REFUNDED | CANCELED
  periodStart       DateTime?
  periodEnd         DateTime?
  paidAt            DateTime?
  invoiceUrl        String?          URL to hosted invoice PDF
  timestamps        createdAt, updatedAt
}
```

**CouponRedemption:**
```
CouponRedemption {
  id              String  PK
  couponId        String  FK -> Coupon
  organizationId  String  FK
  subscriptionId  String? FK -> OrganizationSubscription
  discountAmount  Int
  timestamps      createdAt
}
```

**ApiKey:**
```
ApiKey {
  id              String   PK
  organizationId  String   FK
  name            String   "Production API Key"
  keyHash         String   UNIQUE  (SHA-256 hash)
  keyPrefix       String   "erpx_prod_" (first 10 chars for identification)
  scopes          Json     ["invoices:read", "products:write"]
  lastUsedAt      DateTime?
  expiresAt       DateTime?
  revokedAt       DateTime?
  timestamps      createdAt, updatedAt
}
```

**WebhookEndpoint:**
```
WebhookEndpoint {
  id              String   PK
  organizationId  String   FK
  url             String
  secret          String   HMAC signing secret
  events          String[] ["invoice.created", "subscription.updated"]
  isActive        Boolean
  lastTriggeredAt DateTime?
  timestamps      createdAt, updatedAt
}
```

**WebhookEvent:**
```
WebhookEvent {
  id              String   PK
  endpointId      String   FK -> WebhookEndpoint
  event           String
  payload         Json
  responseStatus  Int?
  responseBody    String?
  deliveredAt     DateTime?
  status          WebhookDeliveryStatus  PENDING | DELIVERED | FAILED
  attempt         Int      default 1
  nextRetryAt     DateTime?
  timestamps      createdAt
}
```

**SupportTicket:**
```
SupportTicket {
  id              String   PK
  organizationId  String   FK
  userId          String   FK
  subject         String
  body            String
  status          TicketStatus  OPEN | IN_PROGRESS | WAITING | RESOLVED | CLOSED
  priority        TicketPriority  LOW | MEDIUM | HIGH | CRITICAL
  assignedToId    String?  FK -> User (super admin)
  resolvedAt      DateTime?
  timestamps      createdAt, updatedAt
}
```

**AiImportSession:**
```
AiImportSession {
  id                  String   PK
  organizationId      String   FK
  userId              String   FK
  entityType          String   "invoice" | "product" | "lead" | "employee"
  fileName            String   "invoices_2026.csv"
  fileType            String   "csv" | "xlsx" | "pdf"
  fileSize            Int      Bytes
  status              ImportStatus  PENDING | MAPPING | VALIDATING | PREVIEW | IMPORTING | COMPLETED | FAILED
  columnMapping       Json?    {"column_name": "entity_field"}
  validationResults   Json?    { errors: [...], warnings: [...] }
  previewData         Json?    First 10 rows
  totalRows           Int?
  successCount        Int?
  errorCount          Int?
  duplicateCount      Int?
  startedAt           DateTime?
  completedAt         DateTime?
  errorMessage        String?
  timestamps          createdAt, updatedAt
}
```

**Conversation (AI Assistant):**
```
Conversation {
  id              String   PK
  organizationId  String   FK
  userId          String   FK
  title           String   "Invoice query"
  messageCount    Int      default 0
  lastMessageAt   DateTime
  timestamps      createdAt, updatedAt

  Messages:
    id            String  PK
    conversationId String FK -> Conversation
    role          MessageRole  USER | ASSISTANT | SYSTEM
    content       String
    metadata      Json?   Tool calls, entities referenced
    createdAt     DateTime
}
```

### 11.3 Indexing Strategy

| Table | Index Columns | Purpose |
|-------|--------------|---------|
| `organizations` | `(status)`, `(plan)`, `(deletedAt)`, `(createdAt)` | Filtering, listing |
| `users` | `(organizationId, email)`, `(status)` | Auth, filtering |
| `roles` | `(organizationId, slug)`, `(isOwner)` | Unique constraint, owner lookup |
| `permissions` | `(resource, action)`, `(groupId)` | Permission resolution |
| `audit_logs` | `(organizationId, createdAt)`, `(event)`, `(actorId)`, `(resource, resourceId)` | Query performance |
| `usage_counters` | `(organizationId, featureId, period)` | Usage tracking |
| `notifications` | `(organizationId, userId, isRead, createdAt)` | User notifications |
| `sessions` | `(userId, revokedAt)`, `(expiresAt)` | Session management |
| `refresh_tokens` | `(token)`, `(family)` | Token rotation |
| `organization_subscriptions` | `(organizationId)`, `(status, currentPeriodEnd)` | Billing queries |
| `billing_invoices` | `(organizationId, status, createdAt)` | Invoice history |
| `ai_import_sessions` | `(organizationId, userId, status, createdAt)` | Import tracking |
| `conversations` | `(organizationId, userId, lastMessageAt)` | AI history |

### 11.4 Soft Delete Policy

- Major entities (Organization, User, Role, etc.) use soft deletes.
- Soft-deleted records are excluded by default via `where: { deletedAt: null }`.
- Junction tables (UserRole, RolePermission) use hard deletes (they reference soft-deletable parents).
- Audit logs are append-only, never deleted.
- Soft-deleted data is retained for 30 days before hard deletion (cron job).

---

## 12. Security Considerations

### 12.1 Authentication & Authorization

- **All** API routes (except auth, health) require JWT authentication by default.
- Authorization is enforced at the route level via `@Permissions()` decorator.
- Row-level security is implicit: every query includes `organizationId`.
- JWT tokens expire after 15 minutes (access) and 7 days (refresh).
- Refresh token rotation prevents replay attacks.

### 12.2 Data Protection

- Passwords hashed with Argon2id (memory-hard, resistant to GPU attacks).
- API keys hashed with SHA-256 (only shown once on creation).
- Sensitive system settings stored encrypted in `SystemSetting.isEncrypted`.
- All database connections use TLS.
- PII (Personally Identifiable Information) is minimized in logs.

### 12.3 API Security

- Helmet middleware for security headers (CSP, HSTS, X-Frame-Options, etc.).
- CORS restricted to configured origin (default: `http://localhost:5173`).
- Rate limiting per IP (ThrottlerModule) with tier-based limits.
- Request body size limited via Express `body-parser` configuration.
- Input validation with `class-validator` (whitelist + forbidNonWhitelisted).

### 12.4 Payment Security

- **Never** store raw payment instrument details (card numbers, UPI IDs).
- Payment processing delegated to Stripe/Razorpay (PCI-DSS compliant).
- Webhook signatures verified for all provider callbacks.
- Idempotency keys prevent duplicate charges.

### 12.5 Audit & Compliance

- All sensitive operations logged to audit log.
- Audit logs are append-only — no UPDATE or DELETE.
- Audit log retention: 90 days minimum, 7 years for Enterprise (configurable).
- Export functionality for GDPR data access requests.
- Login attempts tracked: lockout after 5 failed attempts (15-minute cooldown).

### 12.6 Infrastructure Security

- Secrets managed via environment variables, never hardcoded.
- Database credentials rotated periodically.
- Minimal IAM permissions for cloud resources.
- Docker images scanned for vulnerabilities.
- Regular dependency updates (Dependabot/Renovate).

### 12.7 Rate Limiting & Abuse Prevention

| Measure | Threshold | Action |
|---------|-----------|--------|
| Login attempts | 5 per 15 min per IP | Temporary IP block |
| API key requests | Tier-based per minute | 429 Too Many Requests |
| File upload size | 10MB per file | 413 Payload Too Large |
| Import row count | 10,000 per session | Reject with error |
| AI queries | Tier-based per day | 429 + upgrade prompt |
| Webhook retries | 3 attempts | Mark as failed |

### 12.8 Security Headers (Helmet)

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | strict (self + CDN) |
| `X-Content-Type-Options` | nosniff |
| `X-Frame-Options` | DENY |
| `X-XSS-Protection` | 1; mode=block |
| `Strict-Transport-Security` | max-age=31536000 (1 year) |
| `Referrer-Policy` | same-origin |

---

> **End of Architecture Blueprint**
>
> This document serves as the definitive reference for the ERPX SaaS Platform.
> All implementation work must align with the designs and decisions recorded here.
> Deviations require a design review and an update to this document.
