# ERPX — Product Roadmap

> **Last Updated:** 2026-07-17  
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

## Phase 5: CRM ✅ (Complete)

### Sprint 4 — Customer Relationship Management
- ✅ Lead tracking with status/source/priority workflow
- ✅ Company management with notes and activities
- ✅ Contact management with timelines
- ✅ Pipeline and stage management
- ✅ Deal management with stage transitions
- ✅ Activity history with timeline automation
- ✅ CRM dashboards in reporting platform

---

## Phase 6: Inventory & Procurement ✅ (Complete)

### Sprint 6 — Inventory Management
- ✅ Product catalog with categories and units
- ✅ Warehouse management (CRUD, archive, restore, soft-delete)
- ✅ Stock tracking (reserve, release, adjust, increase, decrease)
- ✅ Inventory transfers (DRAFT → IN_TRANSIT → COMPLETED)
- ✅ Stock ledger (append-only audit trail)
- ✅ Low stock alerts and dashboard KPIs

### Sprint 7 — Procurement & Vendor Management
- ✅ Vendor management with search/filter
- ✅ Purchase orders with status lifecycle
- ✅ Goods receipt with inventory integration
- ✅ Auto PO/GRN numbering (PO-YYMMDD-NNNN)
- ✅ Procurement dashboards

---

## Phase 7: Accounting & HRMS ✅ (Complete)

### Sprint 8 — Accounting Engine
- ✅ Chart of accounts with hierarchy
- ✅ Fiscal years with accounting periods
- ✅ Double-entry journal entries (debits = credits)
- ✅ Journal reversal via opposite entry in transaction
- ✅ Trial balance, balance sheet, P&L reports
- ✅ Accounting hooks for future integration

### Sprint 9 — HRMS Foundation
- ✅ Departments and designations with levels
- ✅ Employee management with hierarchy
- ✅ Attendance tracking (check-in/check-out)
- ✅ Leave management with overlap prevention
- ✅ Payroll hooks (interfaces only)

---

## Phase 8: Reporting, Workflows & AI ✅ (Complete)

### Sprint 10 — Reporting & Analytics Platform
- ✅ Core report engine with reusable primitives
- ✅ 6 domain dashboards (Executive, Sales, Inventory, Procurement, Accounting, HR)
- ✅ 22 report endpoints
- ✅ CSV, Excel XML, PDF HTML exports

### Sprint 11 — Workflow Automation Engine
- ✅ Event bus with 17 standard business events
- ✅ Rule engine with condition evaluation
- ✅ 5 action handlers (Email, Webhook, Notification, Audit, AI Hook)
- ✅ Strategy-pattern action registry
- ✅ Execution logs for audit/debug

### Sprint 12.1 — AI Platform Foundation
- ✅ Multi-provider gateway (OpenAI, Gemini, Claude, Ollama, Azure OpenAI, Bedrock)
- ✅ Provider factory and router with failover
- ✅ Chat, streaming, embeddings, tool calling
- ✅ Health checks and configuration

### Sprint 12.2 — AI Core Runtime
- ✅ Prompt Registry (versioning, interpolation, validation, caching)
- ✅ Capability Registry (models, providers, tools)
- ✅ Tool Registry with AITool interface
- ✅ AI Sandbox (org isolation, RBAC, validation, timeout, audit)
- ✅ Execution Pipeline (registry → sandbox → permission → execute → audit)
- ✅ Decorators (@AITool, @Capability, @AIPermission, @AIMetadata, @ProviderSupport)
- ✅ 102 tests, 930 total

---

## Phase 9: AI Agents & Features 🔜 (Next)

### Sprint 13 — AI Agents
- Domain-specific AI Agents (Sales, Finance, Inventory, HR, Procurement)
- Tool implementations wrapping business services
- Agent orchestration
- Session/organization memory
- Natural language data queries

### Sprint 14 — AI Import Assistant & Enterprise
- AI Excel/CSV/PDF Import Assistant
- AI column mapping engine
- Duplicate detection with embeddings
- SSO/SAML integration
- Web Push and WhatsApp notifications

---

## Timeline Overview

```
Phase 1: Foundation            ████████████████████████████████  Sprint 1-3     ✅
Phase 2: Billing               ████████████████████████████████  Sprint 3.2-3.8  ✅
Phase 3: Portal (Backend)      ████████████████████████████████  Sprint 3.7     ✅
Phase 4: Super Admin           ████████████████████████████████  Sprint 3.8     ✅
Phase 5: CRM                   ████████████████████████████████  Sprint 4       ✅
Phase 6: Inventory/Procurement ████████████████████████████████  Sprint 6-7     ✅
Phase 7: Accounting/HRMS       ████████████████████████████████  Sprint 8-9     ✅
Phase 8: Reports/Workflows/AI  ████████████████████████████████  Sprint 10-12   ✅
Phase 9: AI Agents             ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Sprint 13     🔜
Phase 10: Enterprise           ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Sprint 14     📋
```
