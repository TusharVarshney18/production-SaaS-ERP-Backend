# ERPX — Changelog

> **All notable changes to the ERPX backend platform.**

---

## Sprint 12.3 — 2026-07-17

### Enterprise AI Agent Framework

- **Agent Interface**: `IAgent` contract with execute(), plan(), validate(), canHandle(); AgentMetadata, AgentCapability, AgentExecutionPlan/Step, AgentRequest/Response types
- **Agent Registry**: Map-based dynamic registration with findBestMatch() using confidence × priority scoring; findByCapability/Tool/Provider; deduplicated capability listing
- **Agent Factory**: Dynamic agent resolution with DI support; explicit `agentName` or best-match fallback
- **Agent Router**: Request → best agent + capability match → execution plan → context enrichment from CapabilityRegistry
- **Agent Planner**: Plan creation, validation (tool existence, dependency integrity), complexity estimation (simple/medium/complex)
- **Agent Executor**: Full orchestration — route → validate plan → execute steps through ExecutionPipeline → collect results → structured AgentResponse
- **Context Builder**: Builds ExecutionContext with available tools, capabilities, providers, temperature, streaming config
- **Base Agent**: Abstract class with validate(), execute() pipeline, createStep(), getPromptVariables(); 7 domain agents extend it
- **7 Domain Agents**: CEO (executive oversight), Finance (revenue/invoices/reports), Sales (quotations/orders/customers), Inventory (stock/warehouses/transfers), HR (employees/attendance/leave), Reporting (cross-domain exports), Developer (system health/API/audit)
- **58 new unit tests** across 7 test suites
- Reuses Sprint 12.1 (providers, config, health) and Sprint 12.2 (PromptRegistry, ToolRegistry, CapabilityRegistry, Sandbox, Pipeline, Permission) — zero duplication
- No Prisma access in agents — all execution through registered AI Tools via Execution Pipeline

**Tests:** 988 total (+58) | **Status:** ✅ Build, ✅ Lint (0 errors), ✅ Prisma Validate

---

## Sprint 12.2 — 2026-07-17

### Enterprise AI Core Runtime

- **Prompt Registry**: register, get, search, versioning, variable interpolation (`{{varName}}`), validation, filesystem loading (JSON/frontmatter), in-memory cache with configurable TTL
- **Capability Registry**: register/get/search capabilities; findByTool/Model/Provider; provider preferences, temperature, context limits, streaming flags
- **Tool Registry**: `AITool<TInput, TOutput>` interface with `execute() + validate()`; Map-based registration with category grouping, search, LLM function-calling definitions
- **AI Sandbox**: 5-point validation (org isolation, RBAC, input size, tool.validate, timeout); sensitive data masking; audit logging for every execution
- **Execution Pipeline**: Full orchestration — registry → sandbox → permission → timeout → audit; structured `ExecutionPipelineResult`; batch execution support
- **Decorators**: `@AITool`, `@Capability`, `@AIPermission`, `@AIMetadata`, `@ProviderSupport` using NestJS `SetMetadata` + `Reflector`
- **Metadata Service**: Reflector-based reader for all AI decorator metadata
- **102 new unit tests** across 7 test suites
- Reuses existing AI foundation (Sprint 12.1): IProvider, ProviderFactory, AIGatewayService, config, exceptions
- Reuses existing platform: AuthorizationService (RBAC), AuditLogService (audit trail)

**Tests:** 930 total (+102) | **Status:** ✅ Build, ✅ Lint (0 errors), ✅ Prisma Validate

---

## Sprint 12.1 — 2026-07-13

### AI Platform Foundation

- Created `IProvider` interface with 7-method contract (chat, stream, embed, toolCall, health, countTokens)
- Abstract `BaseProvider` with health(), maskApiKey(), validateAvailability()
- `ProviderFactory` — dynamic Map-based provider registration and lookup
- `ProviderRouterService` — intelligent selection with automatic failover chain
- `AIGatewayService` — unified entry point for all AI operations
- 6 provider implementations: OpenAI, Gemini, Claude, Ollama, Azure OpenAI, AWS Bedrock
- No direct SDK imports — all via fetch(), swappable via config
- Configuration via environment variables with `registerAs('ai', ...)`
- Full Swagger documentation on all endpoints
- 60 comprehensive unit tests (8 test suites)

**Tests:** 828 total (+60) | **Status:** ✅ Build, ✅ Lint, ✅ Prisma Validate

---

## Sprint 3.6.1 — 2026-07-09

### Real Razorpay Integration
- Installed `razorpay` npm package (official SDK)
- Replaced mock RazorpayProvider with real SDK implementation
- Implemented order creation via `razorpay.orders.create()` with org/subscription/plan metadata in notes
- Implemented payment signature verification via `crypto.createHmac('sha256', ...)`
- Implemented webhook signature verification via HMAC-SHA256
- Implemented payment refund via `razorpay.payments.refund()` with partial refund support
- Implemented payment fetch via `razorpay.payments.fetch()` with status mapping
- Added `ensureInitialized()` guard to prevent unconfigured usage
- Added `RazorpayInstance`, `RazorpayOrder`, `RazorpayPayment`, `RazorpayRefund` TypeScript interfaces
- Created `razorpay.config.ts` for environment-based configuration
- Added `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` environment variables
- Added Joi validation for Razorpay env vars
- Registered razorpay config in `ConfigModule.forRoot()`
- Wrote 16 comprehensive unit tests with mocked SDK
- All existing interfaces and services remain unchanged

**Tests:** 291 total (+16) | **Status:** ✅ Build, ✅ Lint, ✅ Prisma Validate

---

## Sprint 3.6 — 2026-07-09

### Payment Gateway Architecture
- Created `PaymentGateway` interface with 4-method contract (`createCheckout`, `verifyPayment`, `refund`, `handleWebhook`)
- Created `PaymentProviderFactory` for DI-based provider registration and lookup
- Created `PaymentGatewayService` facade with no hardcoded provider names
- Moved RazorpayProvider and StripeProvider into subdirectories with provider-specific DTOs
- Created `razorpay.dto.ts` and `stripe.dto.ts` with provider-specific types
- Created `payment-provider.factory.spec.ts`, `razorpay.provider.spec.ts`, `stripe.provider.spec.ts`
- Removed old provider files and updated BillingModule
- Updated BillingService import path

**Tests:** 275 total (+7) | **Status:** ✅ Build, ✅ Lint, ✅ Prisma Validate

---

## Sprint 3.5 — 2026-07-09

### Full Subscription Engine
- **SubscriptionService** facade — `getCurrentSubscription()`, `activateSubscription()`, `cancelSubscription()`, `renewSubscription()`, `suspendSubscription()`
- **SubscriptionLifecycleService** — state machine with `VALID_TRANSITIONS` map for Trial → Active → Grace Period → Suspended → Expired → Cancelled
- **PlanResolver** — `resolveActivePlan()`, `resolveBillingCycle()`, `resolveRenewalDate()`
- **FeatureResolver** — `hasFeature()`, `getFeatures()`, `getEnabledFeatures()`
- **UsageResolver** — `canUse()`, `incrementUsage()`, `resetUsage()`, `getRemainingQuota()`
- **EntitlementService** — unified authorization: `can(feature)`, `checkUsage(feature)`, `getReason(result)`
- Added `TRIAL`, `GRACE_PERIOD`, `SUSPENDED` to `SubscriptionStatus` enum
- Renamed `feature.service.ts` → `feature-resolver.service.ts`, `usage.service.ts` → `usage-resolver.service.ts`
- Restructured subscriptions module

**Tests:** 267 total (+10) | **Status:** ✅ Build, ✅ Lint, ✅ Prisma Validate

---

## Sprint 3.4 — 2026-07-09

### Billing Domain
- **Prisma models:** Payment, Invoice, Coupon, CouponUsage, PaymentMethod, BillingAddress, WebhookEvent
- **PaymentService** — CRUD, mark succeeded/failed, refund with partial support
- **InvoiceService** — CRUD with auto-numbering (`INV-YYYYMM-NNNN`), issue, markPaid, cancel
- **CouponService** — CRUD, 8-point validation pipeline, apply, recordUsage
- **BillingService** — facade orchestrator
- DTOs with Swagger and class-validator on all services
- Updated billing module structure with `payment-gateway.service.ts`
- Proper indexes, foreign keys, multi-currency, tax fields

**Tests:** 257 (+81) | **Status:** ✅ Build, ✅ Lint, ✅ Prisma Validate

---

## Sprint 3.2 — 2026-07-08

### Billing Foundation
- Payment provider abstraction with strategy pattern
- `PaymentProvider` interface with 6 methods
- `PaymentService` skeleton with provider registry
- RazorpayProvider and StripeProvider stubs
- DTOs: CreateCheckout, VerifyPayment, CreateSubscription, CancelSubscription, RefundPayment, HandleWebhook
- Payment types: `PaymentProviderName`, `PaymentCurrency`, `PaymentStatus`

**Tests:** 200 (+16) | **Status:** ✅ Build, ✅ Lint, ✅ Prisma Validate

---

## Sprint 3.1 — 2026-07-08

### Subscription Engine (Core)
- SubscriptionPlan CRUD with Prisma (existing models used)
- OrganizationSubscription lifecycle (activate trial, upgrade, downgrade, cancel, renew, expire)
- Feature resolution service (`getOrganizationFeatures`, `checkFeature`)
- Usage limit service (`checkUsage`, `incrementUsage`, `getRemainingQuota`)
- DTO validation with Swagger documentation
- Proper logging on all service methods
- 81 new unit tests

**Tests:** 186 (+81) | **Status:** ✅ Build, ✅ Lint, ✅ Prisma Validate

---

## Sprint 2 — 2026-07-07

### Core API Foundation
- **Authentication:** JWT-based with refresh token rotation
  - Register with auto-organization creation
  - Login with email/password
  - Token refresh with rotation (token family tracking)
  - Logout with session revocation
  - Concurrent session limit (max 5 per user)
- **Organization Management:** CRUD with soft-delete, restore, pagination, search
- **Organization Settings:** Timezone, currency, date format, fiscal year
- **RBAC (Roles & Permissions):**
  - Pre-defined roles: Owner, Admin, Member, Viewer
  - Custom roles for Business+ plans
  - Permission groups with display ordering
  - Role assignment and removal
  - Permission guard using Reflector metadata
- **Audit Logging:** Append-only structured audit trail
  - Actor types: USER, SYSTEM, API_KEY
  - Severity levels: INFO, WARN, ERROR, CRITICAL
  - Filterable by event, resource, actor, severity, date range
  - Standard event taxonomy (user.*, org.*, role.*, system.*)
- **Infrastructure:**
  - Global exception filter with structured error responses
  - Request ID middleware with `X-Request-Id` header
  - Response transformation interceptor
  - Logging interceptor (METHOD URL STATUS DURATION)
  - Helmet security headers, CORS, compression
  - Swagger documentation at `/api/docs`
  - Rate limiting (100 req/min per IP)

**Tests:** 105 | **Status:** ✅ Build, ✅ Lint, ✅ Prisma Validate

---

## Sprint 1 — 2026-07-06

### Project Scaffolding
- NestJS project initialized with CLI
- Prisma ORM configured with PostgreSQL
- Docker Compose for local PostgreSQL + Redis
- ESLint + Prettier configuration
- Jest testing framework with `jest-mock-extended`
- Turborepo monorepo structure (planned)
- Environment configuration with Joi validation
- Logger setup with `nestjs-pino`
- Health check endpoints (`/api/health`, `/api/ready`)
