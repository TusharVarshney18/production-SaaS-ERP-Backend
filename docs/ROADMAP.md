# ERPX — Product Roadmap

> **Last Updated:** 2026-07-09  
> **Document Owner:** Product Team

---

## Phase 1: SaaS Foundation ✅ (Complete)

### Sprint 1 — Project Scaffolding
- NestJS project setup with modular architecture
- Prisma ORM with PostgreSQL
- Docker Compose for local development
- ESLint, Prettier, Jest configuration
- Turborepo monorepo structure

### Sprint 2 — Core API
- JWT-based authentication with refresh token rotation
- OAuth2.0 social login support
- Organization multi-tenancy with row-level security
- Role-Based Access Control (RBAC) with permission groups
- Organization settings management
- Audit logging with structured events
- Request ID middleware and logging interceptor
- Global exception filters and response transformation
- Swagger/OpenAPI documentation
- Rate limiting (ThrottlerModule)

### Sprint 3 — SaaS Subscription Engine
- SubscriptionPlan CRUD with feature-to-plan mapping
- OrganizationSubscription lifecycle (trial, active, grace period, suspended, canceled, expired)
- Feature flag system with plan-based resolution
- Usage limit tracking with hard/soft enforcement
- Plan upgrade/downgrade with immediate/scheduled transitions
- Trial activation and expired subscription batch processing
- State machine with guarded transitions (`VALID_TRANSITIONS`)

---

## Phase 2: Billing ✅ (Complete)

### Sprint 3.2 — Billing Foundation
- Payment provider abstraction (strategy pattern)
- `PaymentGateway` interface with 4-method contract
- `PaymentProviderFactory` for DI-based provider selection
- `PaymentGatewayService` facade (no hardcoded provider names)

### Sprint 3.4 — Billing Domain
- **Database Models:** Payment, Invoice, Coupon, CouponUsage, PaymentMethod, BillingAddress, WebhookEvent
- All with UUID PKs, org scoping, soft deletes, multi-currency, tax fields, metadata JSON
- **PaymentService** — create, find, markSucceeded, markFailed, refund
- **InvoiceService** — create with auto-numbering (`INV-YYYYMM-NNNN`), issue, markPaid, cancel
- **CouponService** — create, validate (8-point validation), apply, recordUsage
- **BillingService** — facade orchestrator

### Sprint 3.6 — Payment Gateway Architecture
- `payment-gateway.interface.ts` — `createCheckout`, `verifyPayment`, `refund`, `handleWebhook`
- `payment-provider.factory.ts` — Map-based provider registry with DI integration
- `payment-gateway.service.ts` — No hardcoded provider names
- Razorpay and Stripe provider stubs with mock responses

### Sprint 3.6.1 — Razorpay Integration (Real SDK)
- `razorpay` npm package installed and configured
- Order creation via `razorpay.orders.create()`
- Payment signature verification via HMAC-SHA256
- Webhook signature verification via HMAC-SHA256
- Payment refund via `razorpay.payments.refund()`
- Payment fetch via `razorpay.payments.fetch()`
- Environment config: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- All SDK calls mocked in unit tests

### Sprint 3.6.2 — Stripe Integration (Planned)
- Stripe SDK integration
- Checkout session creation
- Payment intent verification
- Webhook signature verification
- Refund processing

---

## Phase 3: Customer Portal 🔜 (Next)

### Sprint 4 — Portal Foundation
- Next.js customer-facing application
- Authentication flow (login, register, password reset)
- Dashboard with usage summary and quick actions
- Organization settings UI
- Team member management
- Subscription & billing portal
  - View current plan and usage
  - Upgrade/downgrade plans
  - View invoices and payment history
  - Manage payment methods
  - API key management

### Sprint 4.1 — Import Wizard
- File upload with drag-and-drop
- AI-powered column mapping UI
- Validation and preview step
- Import execution with progress tracking

---

## Phase 4: Super Admin 📋 (Planned)

### Sprint 5 — Admin Panel
- Separate admin application
- Platform-wide dashboard (MRR, active orgs, usage trends)
- Organization management (view, create, suspend, impersonate)
- Plan and feature management
- Usage analytics and quota monitoring
- Revenue tracking and churn analysis
- Billing operations (invoices, refunds, dunning)
- Support ticket queue with SLA management
- Audit log viewer and export
- System settings and maintenance mode
- AI model configuration

---

## Phase 5: CRM 📋 (Planned)

### Sprint 6 — Customer Relationship Management
- Contact management
- Lead tracking and pipeline
- Deal management with stages
- Activity history and notes
- Email integration
- Task management
- Reporting and analytics
- Customer segmentation

---

## Phase 6: Inventory 📋 (Planned)

### Sprint 7 — Inventory Management
- Product catalog
- Stock tracking with warehouses
- Purchase orders
- Sales orders
- Inventory adjustments
- Barcode/RFID support
- Low stock alerts
- Inventory valuation (FIFO, LIFO, weighted average)
- Supplier management

---

## Phase 7: HRMS 📋 (Planned)

### Sprint 8 — Human Resource Management
- Employee directory and profiles
- Attendance tracking
- Leave management
- Payroll processing
- Expense management
- Performance reviews
- Document management
- Onboarding/offboarding workflows

---

## Phase 8: AI Platform 📋 (Planned)

### Sprint 9 — AI Infrastructure
- AI Gateway with provider abstraction (OpenAI, Anthropic)
- Prompt template management
- Token usage tracking and cost attribution
- PII detection and redaction

### Sprint 10 — AI Features
- AI Excel/CSV/PDF Import Assistant
  - AI column mapping engine
  - Data validation with AI
  - Duplicate detection with embeddings
  - Smart suggestions based on context
- AI Assistant — natural language interface
- OCR pipeline for scanned documents
- Natural language data queries

---

## Phase 9: Production Launch 📋 (Future)

### Sprint 11 — Enterprise & Scale
- SSO/SAML integration
- Schema-per-tenant isolation
- Dedicated infrastructure provisioning
- Advanced analytics and reporting
- API marketplace for integrations

### Sprint 12 — Platform Maturity
- Web Push notifications
- WhatsApp notification channel
- Workflow automation engine
- Mobile application
- Public API with developer portal
- Marketplace for plugins and integrations

---

## Timeline Overview

```
Phase 1: Foundation      ████████████████████░░░░░░░░░░░░  Sprint 1-3     ✅
Phase 2: Billing         ████████████████████░░░░░░░░░░░░  Sprint 3.2-3.6  ✅
Phase 3: Portal          ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Sprint 4       🔜
Phase 4: Super Admin     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Sprint 5       📋
Phase 5: CRM             ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Sprint 6       📋
Phase 6: Inventory       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Sprint 7       📋
Phase 7: HRMS            ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Sprint 8       📋
Phase 8: AI Platform     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Sprint 9-10    📋
Phase 9: Production      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Sprint 11-12   📋
```
