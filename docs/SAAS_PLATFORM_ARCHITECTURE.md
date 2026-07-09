# ERPX SaaS Platform — Architecture Blueprint

**Document Version:** 1.0.0  
**Status:** Approved  
**Last Updated:** 2026-07-08  
**Author:** Architecture Team  
**Classification:** Internal — ERPX Architecture Blueprint

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Product Vision](#2-product-vision)
3. [SaaS Architecture](#3-saas-architecture)
4. [Customer Portal Architecture](#4-customer-portal-architecture)
5. [Super Admin Architecture](#5-super-admin-architecture)
6. [Subscription System](#6-subscription-system)
7. [Feature Flag System](#7-feature-flag-system)
8. [Usage Limit System](#8-usage-limit-system)
9. [Billing Architecture](#9-billing-architecture)
10. [Notification Architecture](#10-notification-architecture)
11. [AI Platform](#11-ai-platform)
12. [AI Excel/CSV/PDF Import Assistant](#12-ai-excelcsvpdf-import-assistant)
13. [Database Design](#13-database-design)
14. [API Design](#14-api-design)
15. [Folder Structure](#15-folder-structure)
16. [Security Architecture](#16-security-architecture)
17. [Scaling Strategy](#17-scaling-strategy)
18. [Multi-Tenancy Strategy](#18-multi-tenancy-strategy)
19. [Future Roadmap](#19-future-roadmap)

---

## 1. Executive Overview

ERPX is a multi-tenant SaaS enterprise resource platform that provides organizations with tools for data management, AI-powered import/processing, workflow automation, and business intelligence. The platform is designed from the ground up as cloud-native, supporting horizontal scaling, tenant isolation, and a tiered subscription model.

### 1.1 Purpose

This document defines the architectural vision, principles, and patterns that govern all development of the ERPX SaaS platform. It serves as the authoritative reference for engineering teams, product managers, and stakeholders throughout the development lifecycle.

### 1.2 Architecture Principles

- **Tenant Isolation First:** Every architectural decision enforces strict data and resource isolation between organizations.
- **API-First Design:** All capabilities are exposed through well-defined APIs. The UI consumes APIs; it does not bypass them.
- **Stateless Core:** Application servers remain stateless. Session state is externalized to Redis/caching layers.
- **Observability by Default:** Every component emits structured logs, metrics, and traces.
- **Fail-Safe Billing:** Billing operations are idempotent, auditable, and resilient to partial failures.
- **AI as a Platform Layer:** AI capabilities are abstracted behind a dedicated AI orchestration layer, not embedded in individual services.

---

## 2. Product Vision

ERPX empowers organizations of all sizes to manage enterprise data with consumer-grade simplicity. By combining traditional ERP functionality with modern AI capabilities — including natural language data import, intelligent column mapping, duplicate detection, and validation — ERPX eliminates the complexity barrier that prevents small and medium businesses from adopting enterprise-grade data management tools.

### 2.1 Target Audience

- **Small Business (Free/Growth):** Solo entrepreneurs and small teams needing basic data management and import capabilities.
- **Mid-Market (Business):** Growing organizations requiring advanced features, team collaboration, and API access.
- **Enterprise (Enterprise/Custom):** Large organizations with complex compliance needs, dedicated support, and custom integrations.

### 2.2 Core Value Propositions

- Zero-configuration AI-powered data import
- Intelligent schema mapping and validation
- Role-based team collaboration
- Pay-as-you-grow subscription model
- Enterprise-grade security and isolation

---

## 3. SaaS Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CDN / CloudFront                      │
├─────────────────────────────────────────────────────────────┤
│                    API Gateway / Load Balancer               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Application Services Layer              │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌─────────┐   │    │
│  │  │Auth  │ │Org   │ │Import│ │AI    │ │Billing  │   │    │
│  │  │Svc   │ │Svc   │ │Svc   │ │Svc   │ │Svc      │   │    │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └─────────┘   │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌─────────┐            │    │
│  │  │Notif │ │Audit │ │Report│ │Workflow │            │    │
│  │  │Svc   │ │Svc   │ │Svc   │ │Svc      │            │    │
│  │  └──────┘ └──────┘ └──────┘ └─────────┘            │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              AI Orchestration Layer                  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │    │
│  │  │LLM       │ │OCR       │ │Embedding │            │    │
│  │  │Gateway   │ │Engine    │ │Service   │            │    │
│  │  └──────────┘ └──────────┘ └──────────┘            │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Infrastructure Layer                    │    │
│  │  PostgreSQL │ Redis │ RabbitMQ │ S3      │          │    │
│  │  (Tenant)   │       │          │ (Files) │          │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│               Monitoring │ Logging │ Alerting                │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Tenancy Model | Hybrid (Schema per tenant + Shared) | Row-level tenant_id for core data, separate schema for tenants requiring strict isolation (Enterprise) |
| API Protocol | REST (primary) + WebSocket (real-time) | Wide compatibility; WebSocket for import progress and notifications |
| Auth Protocol | JWT + OAuth2.0 | Stateless auth with refresh token rotation |
| Message Broker | RabbitMQ | Reliable delivery, delayed queues for billing retries, dead-letter support |
| Cache | Redis | Session store, rate limiting, feature flag cache, lock management |
| File Storage | S3-compatible (MinIO/Local for dev) | Scalable, durable, tenant-prefixed paths |
| Database | PostgreSQL 16 | JSONB for flexible metadata, row-level security for tenant isolation, partitioning for large tables |
| AI Provider | Pluggable LLM Gateway | Support for OpenAI, Anthropic, local models via abstraction layer |

### 3.3 Service Communication Patterns

- **Synchronous:** RESTful HTTP between services for request-response flows (auth, org management, CRUD operations).
- **Asynchronous:** RabbitMQ for event-driven flows (billing events, notification dispatch, import completion).
- **Real-time:** WebSocket connections for import progress streaming, live notifications, and collaborative features.

### 3.4 Event-Driven Architecture

The platform adopts an event-driven paradigm for cross-cutting concerns:

```
Producer → Event Bus → Consumer(s)
```

**Core Event Types:**

| Event | Producer | Consumer(s) | Purpose |
|---|---|---|---|
| `organization.created` | Org Service | Billing, Notification, Audit | Provision trial subscription |
| `subscription.changed` | Billing Service | Feature Flag, Usage, Notification | Update plan entitlements |
| `import.completed` | Import Service | AI Service, Notification, Audit | Trigger post-processing |
| `usage.threshold_exceeded` | Usage Service | Billing, Notification | Alert on limit breaches |
| `payment.failed` | Billing Service | Notification, Subscription | Trigger dunning workflow |
| `user.invited` | Org Service | Notification, Audit | Send invitation |

---

## 4. Customer Portal Architecture

### 4.1 Overview

The Customer Portal is the primary user-facing application. It is a single-page application (SPA) that provides authenticated users with access to their organization's data management, import, and collaboration tools based on their subscription tier.

### 4.2 Module Breakdown

| Module | Description |
|---|---|
| Dashboard | Usage summary, recent imports, quick actions, plan overview |
| Data Import | AI-powered import wizard for Excel, CSV, and PDF files |
| Data Management | View, edit, search, and manage imported data |
| Team Management | Invite members, manage roles, configure permissions |
| Settings | Profile, organization settings, notification preferences, billing |
| AI Assistant | Natural language interface for data operations |
| Usage & Billing | View current usage, plan details, invoices, payment methods |
| Support | Ticket creation, knowledge base, chat support |

### 4.3 Navigation Structure

```
Dashboard
├── Overview
├── Quick Import
└── Recent Activity

Data
├── Import Wizard
│   ├── File Upload
│   ├── AI Column Mapping
│   ├── Validation & Preview
│   └── Import & Confirm
├── Data Tables
│   ├── View
│   ├── Search
│   ├── Filter
│   └── Export
└── Templates

Team
├── Members
├── Roles
└── Activity Log

AI
├── AI Assistant
├── Smart Import
├── Duplicate Detection
└── Validation Rules

Settings
├── Profile
├── Organization
├── Billing & Usage
├── Notifications
└── API Keys

Support
├── Help Center
├── Tickets
└── Chat
```

### 4.4 State Management

- Global state: Current user, organization, subscription tier, feature flags
- Domain state: Import wizard progress, data table filters, selected records
- Cache strategy: Stale-while-revalidate for dashboard and usage data

### 4.5 Route Design

```
/                          → Dashboard
/import                    → Import Wizard (file upload)
/import/:id                → Import Wizard (existing import)
/import/:id/mapping        → AI Column Mapping step
/import/:id/preview        → Validation & Preview step
/data                      → Data Tables
/data/:tableId             → Table detail view
/team                      → Team Management
/team/members              → Members list
/team/roles                → Role management
/settings                  → Settings
/settings/billing          → Billing & Usage
/settings/notifications    → Notification preferences
/settings/api-keys         → API key management
/ai                        → AI Assistant
/support                   → Support Center
/support/tickets/:id       → Ticket detail
```

---

## 5. Super Admin Architecture

### 5.1 Overview

The Super Admin Panel is a separate administrative application for platform operators. It provides full visibility and control over all tenants, plans, billing, and system configuration.

### 5.2 Module Breakdown

| Module | Description |
|---|---|
| Dashboard | Platform-wide metrics: active organizations, MRR, usage trends, system health |
| Organizations | Tenant management: view, create, suspend, delete; impersonation capability |
| Plans | Subscription plan CRUD; feature-to-plan mapping; pricing tiers |
| Feature Management | Create and manage feature flags; assign to plans; toggle globally |
| Usage Analytics | Cross-tenant usage dashboards; quota consumption trends; top users |
| Revenue | MRR/ARR tracking; revenue charts; churn analysis; LTV metrics |
| Billing Operations | Invoice management; manual refunds; credit adjustments; dunning oversight |
| Support Queue | Cross-tenant ticket management; priority assignment; SLAs |
| Audit Logs | Immutable audit trail of platform-wide and tenant-specific events |
| System Settings | Global configuration: rate limits, default quotas, maintenance mode |
| AI Model Management | Configure AI provider keys, model selection, prompt templates |

### 5.3 Admin Navigation

```
/admin
├── Dashboard
├── Organizations
│   ├── All Organizations
│   ├── Pending Approval
│   └── Suspended
├── Plans
│   ├── All Plans
│   ├── Create Plan
│   └── Plan Comparison
├── Features
│   ├── Feature Flags
│   └── Plan Mapping
├── Analytics
│   ├── Usage
│   ├── Revenue
│   ├── Churn
│   └── Reports
├── Billing
│   ├── Invoices
│   ├── Transactions
│   ├── Coupons
│   └── Dunning
├── Support
│   ├── Tickets
│   ├── Knowledge Base
│   └── Chat Logs
├── Audit
│   ├── Activity Log
│   ├── Security Events
│   └── Export
└── Settings
    ├── General
    ├── AI Configuration
    ├── Email Templates
    └── Maintenance
```

### 5.4 Admin Permissions

| Role | Scope | Capabilities |
|---|---|---|
| Super Admin | Full platform | All operations, including billing modifications, tenant impersonation |
| Support Admin | Limited | View organizations, manage support tickets, view audit logs |
| Read-Only Admin | View-only | Access dashboards, analytics, audit logs |
| Billing Admin | Billing only | Manage invoices, coupons, refunds, payment configuration |

---

## 6. Subscription System

### 6.1 Plan Tiers

#### Free Tier
- **Target:** Individuals and micro-businesses evaluating the platform
- **Users:** Up to 2
- **Storage:** 100 MB
- **Imports:** 50 rows per import, 10 imports per month
- **AI Features:** Basic column mapping only
- **Support:** Community/Knowledge base
- **Duration:** Unlimited

#### Growth Tier
- **Target:** Small teams needing regular data management
- **Users:** Up to 10
- **Storage:** 5 GB
- **Imports:** 10,000 rows per import, unlimited imports
- **AI Features:** Full AI mapping, duplicate detection, validation
- **API Access:** Yes (rate-limited)
- **Support:** Email (48hr SLA)
- **Price:** Monthly and annual billing

#### Business Tier
- **Target:** Growing organizations with advanced needs
- **Users:** Up to 50
- **Storage:** 50 GB
- **Imports:** 500,000 rows per import, unlimited imports
- **AI Features:** Full AI suite including OCR
- **API Access:** Yes (higher rate limits)
- **Support:** Priority email + Chat (8hr SLA)
- **Advanced:** Custom validation rules, team roles, audit logs
- **Price:** Monthly and annual billing

#### Enterprise Tier
- **Target:** Large organizations with compliance requirements
- **Users:** Unlimited
- **Storage:** 1 TB+
- **Imports:** Unlimited row counts
- **AI Features:** Full AI suite + custom model fine-tuning
- **API Access:** Dedicated API capacity
- **Support:** Dedicated account manager + 24/7 phone/email (1hr SLA)
- **Advanced:** SSO/SAML, dedicated infrastructure, custom integrations
- **Compliance:** SOC2, GDPR, HIPAA-ready
- **Pricing:** Custom quote

#### Custom Plans
- Fully tailored plans for unique enterprise requirements
- Custom feature combinations, SLA terms, and pricing
- Private cloud/on-premise deployment options
- Dedicated infrastructure with guaranteed resource reservations

### 6.2 Plan Entitlement Model

```
Plan
├── Features (Feature Flag set)
│   ├── ai_import_enabled
│   ├── ocr_enabled
│   ├── api_access_enabled
│   ├── team_roles_enabled
│   └── audit_log_enabled
├── Limits (Usage Limit set)
│   ├── max_users
│   ├── storage_bytes
│   ├── max_rows_per_import
│   ├── max_imports_per_month
│   └── api_rate_limit
├── Pricing
│   ├── monthly_price
│   ├── annual_price
│   ├── currency
│   ├── trial_days
│   └── setup_fee
└── Metadata
    ├── display_name
    ├── description
    ├── sort_order
    ├── is_public
    └── is_active
```

### 6.3 Subscription Lifecycle

```
Trial → Active → Past Due → Canceled → [End of Period]
  │                  │
  └→ Active          └→ Suspended (if not resolved)
       │
       └→ Upgraded / Downgraded (scheduled at period end)
```

### 6.4 Trial Management

- Trial period configurable per plan (default: 14 days for Growth/Business)
- Enterprise trials: 30 days with account manager assistance
- Trial limitations enforced via the same Feature Flag and Usage Limit systems
- Automatic conversion prompt sent 3 days before trial expiry
- Grace period of 48 hours after trial expiry before feature restriction

### 6.5 Renewal and Churn

- **Auto-renewal:** Enabled by default; charged on period end date
- **Dunning:** 3 email attempts over 7 days for failed payments
- **Grace Period:** 5 days after failed payment before suspension
- **Data Retention:** 30 days post-cancellation; full export available
- **Reactivation:** Full data restoration within 30 days of cancellation

---

## 7. Feature Flag System

### 7.1 Purpose

The Feature Flag System controls which product capabilities are available to each organization based on their subscription plan, trial status, and any temporary overrides.

### 7.2 Architecture

```
[Request] → Auth Middleware → Feature Flag Middleware → Controller
                                    │
                            [Feature Flag Service]
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            [Plan Entitlement]              [Per-Org Override]
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                            [Redis Cache]
                                    │
                            [PostgreSQL]
```

### 7.3 Flag Evaluation Pipeline

1. Cache lookup (Redis): `feature:{orgId}:{flagKey}`
2. On cache miss, evaluate from database:
   a. Check per-organization overrides (admin can enable/disable specific flags)
   b. Check plan-to-feature mapping for the org's current plan
   c. Check if org is in trial (some flags may be enabled during trial)
3. Cache result with TTL (default: 5 minutes)
4. Return boolean + optional metadata (e.g., upgrade prompt URL)

### 7.4 Flag Categories

| Category | Example Flags | Evaluated |
|---|---|---|
| Plan Features | `ai_import_enabled`, `ocr_enabled`, `api_access_enabled` | Against plan entitlement |
| Tier Gates | `max_users`, `max_storage` | As comparison against usage limits |
| Operational | `maintenance_mode`, `feature_alpha_rollout` | Global or per-org |
| Beta Programs | `beta_smart_mapping_v2`, `beta_workflow` | Per-org opt-in |

### 7.5 Admin Overrides

Super admins can set per-organization feature overrides for:
- **Enable override:** Force-enable a flag regardless of plan
- **Disable override:** Force-disable a flag for specific orgs
- **Temporary grant:** Enable for a specified duration (used for trials, support)

### 7.6 Cache Invalidation

Invalidation triggers:
- Plan change for an organization
- Admin override created/updated/deleted
- Feature-to-plan mapping updated
- Manual cache clear via admin panel

---

## 8. Usage Limit System

### 8.1 Purpose

The Usage Limit System tracks consumption of billable and restricted resources across organizations, enforcing plan-defined quotas in real-time.

### 8.2 Tracked Resources

| Resource | Unit | Granularity | Reset |
|---|---|---|---|
| Storage | Bytes | Organization | Never (total) |
| Import Rows | Rows per import | Single import | Per import |
| Monthly Imports | Count | Organization | Monthly |
| API Requests | Count | Per API key | Daily/Monthly |
| Active Users | Count | Organization | Current count |
| AI Processing | Tokens/Requests | Organization | Monthly |
| File Uploads | Count/Size | Organization | Monthly |

### 8.3 Architecture

```
[Write Operation] → Usage Middleware → Controller → Database
                          │
              [Usage Service]
                          │
              ┌───────────┴───────────┐
              │                       │
      [Counter Store]         [Limit Evaluator]
              │                       │
          [Redis]               [Redis + Postgres]
              │                       │
      Increment counter      Compare against plan limit
              │                       │
      ┌───────┴───────┐       ┌───────┴───────┐
      │  Within Limit  │       │ Exceeded      │
      │  → Proceed     │       │ → Reject      │
      │                │       │ → Warn        │
      └───────────────┘       └───────────────┘
```

### 8.4 Counting Strategy

- **Redis Counters:** High-frequency counters (imports, API calls) use Redis atomic increment with periodic persistence to PostgreSQL
- **Database Queries:** Storage usage computed via periodic aggregation queries
- **Near Real-time:** Redis counters provide near real-time enforcement; PostgreSQL provides authoritative totals for billing

### 8.5 Enforcement Levels

| Level | Behavior |
|---|---|
| Soft Limit | Warning notification; operation proceeds |
| Hard Limit | Operation blocked; upgrade prompt shown |
| Warning Threshold | Customizable % (default 80%) triggers proactive notification |

### 8.6 Admin Controls

- View real-time usage for any organization
- Manually adjust counters (e.g., grant additional quota)
- Set custom limits override per organization
- Export usage reports

---

## 9. Billing Architecture

### 9.1 Payment Processors

ERPX supports dual payment processor architecture:

| Processor | Primary Market | Status |
|---|---|---|
| Razorpay | India (INR) | Active |
| Stripe | Global (USD, EUR, GBP) | Active |

### 9.2 Architecture Overview

```
[Customer Portal] ─→ [Billing Service] ─→ [Payment Gateway]
       │                      │
       │              [Invoice Service]
       │                      │
       │              [Accounting Export]
       │                      │
       └──────────────── [Notification Service]
```

### 9.3 Core Flows

#### 9.3.1 Subscription Purchase

```
User selects plan → Billing Service creates subscription
         → Payment Gateway creates checkout session
         → User completes payment on gateway
         → Webhook received → Subscription activated
         → Feature flags updated → Notification sent
```

#### 9.3.2 Plan Change (Upgrade)

```
User selects new plan → Immediate feature entitlement update
         → Prorated charge calculated → Payment processed
         → Invoice generated
         → Full plan change takes effect at next billing cycle
```

#### 9.3.3 Plan Change (Downgrade)

```
User selects lower plan → Scheduled for period end
         → Current plan continues until end of billing period
         → At period end: plan changed, features adjusted
```

#### 9.3.4 Cancellation

```
User initiates cancellation → Scheduled at period end
         → Retention offer may be presented
         → At period end: access revoked, data retained for 30 days
         → Final invoice generated
```

### 9.4 Coupon System

| Coupon Type | Description |
|---|---|
| Percentage Discount | e.g., 20% off for 3 months |
| Fixed Amount | e.g., $50 off first invoice |
| Free Months | e.g., 2 months free on annual plan |
| Lifetime Discount | Permanent % discount for legacy customers |

Coupon properties:
- Single-use or multi-use
- Stackable or exclusive
- Expiration date
- Plan-specific or global
- First-time customer only or all

### 9.5 Invoice System

- Generated automatically at each billing cycle
- Available in PDF format via Customer Portal
- Includes: line items, tax breakdown, payment status
- Stored immutably with reference to payment gateway transaction ID
- Credit notes issued for refunds/adjustments

### 9.6 Dunning Management

Progressive recovery workflow for failed payments:

```
Day 0: Payment failed → Email notification
Day 1: Retry 1 (automatic)
Day 2: Retry 2 (automatic) + Email escalation
Day 4: Retry 3 (automatic) + In-app notification
Day 7: Final notice → Account suspension pending
Day 12: Account suspended (read-only mode)
Day 42: Data scheduled for deletion (final warning)
```

### 9.7 Tax Handling

- Automatic tax calculation based on customer location
- Support for VAT, GST, Sales Tax
- Tax ID validation (VAT number, GSTIN)
- Tax-exempt organizations supported with documentation
- Periodic tax reporting exports

### 9.8 Refund Policy

- Self-serve refunds within 14 days of payment
- Pro-rata refunds for early cancellation on annual plans
- Manual refunds via Super Admin for special cases
- All refunds recorded in audit log

---

## 10. Notification Architecture

### 10.1 Overview

The Notification System provides multi-channel delivery of platform communications to end users and administrators.

### 10.2 Channel Matrix

| Channel | Implementation | Status | Priority |
|---|---|---|---|
| In-app | WebSocket push + Notification panel | Active | High |
| Email | Transactional email service (Resend/SES) | Active | High |
| Push | Web Push API / FCM | Planned | Medium |
| WhatsApp | Business API integration | Planned | Low |

### 10.3 Architecture

```
[Event Bus] → [Notification Service]
                    │
            [Channel Router]
            ┌───┼───┬───┬───┐
            │   │   │   │   │
        [Email] [In-app] [Push] [WhatsApp]
            │   │   │   │   │
            └───┴───┴───┴───┘
                    │
            [Template Engine]
                    │
           [Delivery Queue]
                    │
            [Delivery Report]
```

### 10.4 Template System

- Templates defined per channel per notification type
- Variable interpolation using standardized context objects
- Multi-language support (locale-based template selection)
- Admin UI for template preview and editing
- Versioned templates with audit trail

### 10.5 Notification Types

| Category | Types | Channels |
|---|---|---|
| Account | Welcome, Verification, Password Reset, Login Alert | Email, In-app |
| Billing | Invoice, Payment Success, Payment Failed, Subscription Ending, Renewal Notice | Email, In-app |
| Import | Import Complete, Import Failed, Validation Warnings, Duplicates Found | Email, In-app |
| Team | Invitation, Member Joined, Role Changed, Member Removed | Email, In-app |
| Usage | Limit Warning, Limit Exceeded, Storage Full | Email, In-app |
| Admin | New Organization, Suspicious Activity, System Alert | Email |

### 10.6 Delivery Logic

1. Event arrives at Notification Service
2. Determine notification type and target user(s)
3. Load user's channel preferences and notification settings
4. For each enabled channel:
   a. Load template
   b. Render with event context
   c. Enqueue delivery task
5. Track delivery status (sent, delivered, failed, opened)
6. Retry failed deliveries up to 3 times with exponential backoff

### 10.7 User Preferences

Users can configure:
- Which notification categories they receive
- Which channels each category uses
- Digest frequency (immediate, daily, weekly) for non-critical notifications
- Quiet hours (do not disturb period)

### 10.8 In-App Notification Center

- Persistent notification panel accessible from any page
- Notifications grouped by category
- Read/unread state tracked per user
- Click-through actions (e.g., "View Import" navigates to import detail)
- Auto-dismissal for transient notifications
- Unread badge count on navigation

---

## 11. AI Platform

### 11.1 Overview

The AI Platform is a centralized orchestration layer that provides AI/ML capabilities to all ERPX services. It abstracts underlying AI providers, manages prompt templates, handles token usage tracking, and provides a unified interface for AI operations.

### 11.2 Architecture

```
[Consumer Services] → [AI Gateway] → [AI Providers]
(Import Svc)              │           (OpenAI, Anthropic, etc.)
(Analytics Svc)    [LLM Service]
(AI Assistant)           │
                   [Prompt Manager]
                           │
                   [Token Usage Tracker]
                           │
                   [Embedding Service]
```

### 11.3 AI Gateway

The AI Gateway is the single entry point for all AI operations. Responsibilities:
- Provider abstraction (swap LLM providers without consumer changes)
- Request/response logging for audit and debugging
- Token usage tracking and cost attribution
- Rate limiting per tenant
- Fallback provider on failure
- Request timeout management

### 11.4 Core AI Capabilities

| Capability | Description | Models Used |
|---|---|---|
| Column Mapping | Map uploaded file columns to system fields | GPT-4o, Claude 3.5 |
| Data Validation | Validate row data against rules and schemas | GPT-4o-mini |
| Duplicate Detection | Identify and merge duplicate records | Embedding + Vector DB |
| OCR | Extract text from scanned PDFs/images | Tesseract + LLM |
| NL Commands | Natural language to query/filter data | GPT-4o |
| AI Assistant | Conversational interface for platform help | GPT-4o, Claude 3.5 |
| Smart Suggestions | Suggest field mappings based on context | Embedding + LLM |
| Data Enrichment | Enrich records from public knowledge | GPT-4o (optional) |

### 11.5 Prompt Management

- **Prompt Templates** stored in database with versioning
- **Template Variables** for dynamic content injection
- **A/B Testing** capability for prompt optimization
- **Prompt Chaining** for complex multi-step AI workflows
- **Admin UI** for viewing and editing prompt templates

### 11.6 Usage Tracking

- Token counts tracked per organization per request
- Aggregated daily/monthly for billing
- Alerting on unusual usage patterns
- Cost allocation per tenant

### 11.7 AI Safety & Guardrails

- PII detection and redaction before sending to AI providers
- Content filtering for inappropriate inputs/outputs
- Rate limits per API key per minute
- Maximum token limits per request
- Audit logging of all AI interactions

---

## 12. AI Excel/CSV/PDF Import Assistant

### 12.1 Overview

The AI Import Assistant is the flagship feature of ERPX. It transforms the traditionally painful process of importing spreadsheet data into databases into a guided, intelligent, three-step wizard with zero-configuration AI assistance.

### 12.2 User Flow

```
Step 1: Upload
┌─────────────────────────────────────────────┐
│ Drop file or browse                          │
│ Supported: .xlsx, .xls, .csv, .pdf          │
│ File size limit based on plan                │
│ Preview of first 10 rows shown               │
│ AI auto-detects file type and encoding       │
└─────────────────────────────────────────────┘
         │
         ▼
Step 2: AI Column Mapping
┌─────────────────────────────────────────────┐
│ AI suggests column-to-field mappings        │
│ User can accept, modify, or reject          │
│ Smart matching based on header names,       │
│ sample data patterns, and context           │
│ Confidence indicators per mapping           │
│ Manual mapping fallback                     │
└─────────────────────────────────────────────┘
         │
         ▼
Step 3: Validation & Preview
┌─────────────────────────────────────────────┐
│ AI validates rows against schema rules     │
│ Duplicate detection highlighted             │
│ Data type validation                        │
│ Error count and severity summary            │
│ Preview of how data will appear post-import │
│ Edit inline before confirming               │
└─────────────────────────────────────────────┘
         │
         ▼
Step 4: Import & Confirm
┌─────────────────────────────────────────────┐
│ Import executed (sync for small, async for  │
│ large datasets)                             │
│ Progress bar with real-time updates         │
│ Summary: rows imported, errors, skipped     │
│ Undo option within 5 minutes                │
│ Notification on completion                  │
└─────────────────────────────────────────────┘
```

### 12.3 Processing Pipeline

```
Upload → File Validation → Parse → AI Column Mapping
    → Validation → Duplicate Detection → Preview
    → Import Execution → Post-Processing → Notification
```

### 12.4 File Parsing Strategy

| File Type | Parser | Notes |
|---|---|---|
| .xlsx | SheetJS / Custom parser | Preserve formatting, multiple sheets |
| .xls | SheetJS | Legacy format support |
| .csv | Custom CSV parser | Encoding detection, delimiter auto-detection |
| .pdf (text) | PDF text extraction | Extract tables where possible |
| .pdf (scanned) | OCR pipeline | Tesseract → LLM structure extraction |

### 12.5 AI Column Mapping Engine

The mapping engine uses a multi-strategy approach:

1. **Header Matching:** Exact and fuzzy match column headers against known field names
2. **Sample Data Analysis:** AI analyzes first 50 rows of data to infer column semantics
3. **Context-Aware Suggestions:** Previous import history for the same organization informs suggestions
4. **Confidence Scoring:** Each mapping suggestion includes a confidence score (0-100%)
5. **Fallback:** User can manually map any column not auto-detected

### 12.6 Validation Rules

- **Type Validation:** String, number, date, email, phone, URL format checking
- **Required Field Validation:** Missing required fields flagged
- **Uniqueness Validation:** Duplicate values in unique columns flagged
- **Reference Validation:** Foreign key references checked (for existing data)
- **Custom Rules:** Plan-dependent custom validation rules (Business+)
- **Range Validation:** Min/max value checking
- **Pattern Validation:** Regex-based pattern matching

### 12.7 Duplicate Detection

- Exact match on key fields
- Fuzzy match using embedding similarity (AI-powered)
- Configurable matching criteria per import
- Suggested merge actions for detected duplicates
- User decides: skip, update, or create

### 12.8 Large File Handling

- Files > 100MB or > 100K rows processed asynchronously
- Progress streamed via WebSocket
- Chunked processing with checkpoint recovery
- Result notification on completion
- Admin monitoring of active imports

---

## 13. Database Design

### 13.1 Tenancy Model

ERPX uses a hybrid tenancy approach:

| Tier | Isolation Model | Description |
|---|---|---|
| Free / Growth | Row-level (shared tables) | `organization_id` column on every tenant-scoped table |
| Business | Row-level (shared tables) | Same, with optional partition by org_id |
| Enterprise | Schema-per-tenant | Isolated PostgreSQL schema per customer |

### 13.2 Schema Organization

**Shared Schema** (`public`):

| Domain | Tables | Description |
|---|---|---|
| Platform | plans, features, plan_features, coupons | Global configuration tables |
| System | audit_logs, system_settings, email_templates | Cross-tenant system data |

**Per-Tenant Data** (row-level or schema):

| Domain | Tables | Description |
|---|---|---|
| Organization | organizations, org_settings, org_feature_overrides | Tenant metadata |
| Users | users, team_members, roles, permissions | User management |
| Subscriptions | subscriptions, invoices, invoice_line_items, payments | Billing data |
| Imports | imports, import_files, import_mappings, import_results | Import records |
| Data | tables, records, record_versions | Imported data |
| AI | ai_requests, ai_responses, token_usage | AI interaction logs |
| Notifications | notifications, notification_templates, notification_logs | Notification data |

### 13.3 Indexing Strategy

- B-tree indexes on all foreign keys and sort columns
- GIN indexes on JSONB columns for flexible querying
- Partial indexes for soft-deleted and archived records
- Composite indexes for common query patterns (org_id + created_at)
- Exclusion constraints for overlapping date ranges (subscriptions)
- Full-text search indexes on data tables (configurable)

### 13.4 Partitioning

- `audit_logs`: Partitioned by month (time-based)
- `import_results`: Partitioned by org_id (list-based)
- `notifications`: Partitioned by month (time-based)
- `token_usage`: Partitioned by month (time-based)

### 13.5 Data Retention Policies

| Data Type | Retention | Action |
|---|---|---|
| Active records | Indefinite | Keep |
| Soft-deleted records | 30 days | Auto-purge |
| Audit logs | 365 days | Archive to cold storage |
| Notification logs | 90 days | Auto-purge |
| AI request/response logs | 90 days | Auto-purge (anonymized) |
| Invoice records | 7 years (legal) | Keep |
| Abandoned org data | 30 days post-cancellation | Permanent deletion |

### 13.6 Backup Strategy

- Continuous WAL archiving (point-in-time recovery)
- Daily full backups
- Cross-region replication for disaster recovery
- Backup retention: 30 days for daily, 12 months for monthly snapshots

---

## 14. API Design

### 14.1 Design Principles

- RESTful resource-oriented URLs
- Consistent error responses for all endpoints
- Versioned via URL prefix (`/api/v1/`)
- Pagination, filtering, and sorting on all list endpoints
- Rate limiting per API key and per organization
- Idempotency support for payment and import operations

### 14.2 Base URL Structure

```
/api/v1/
├── auth/              # Authentication & authorization
├── organizations/     # Organization management
├── users/             # User management
├── teams/             # Team and role management
├── imports/           # Import operations
│   ├── upload/        # File upload
│   ├── mapping/       # Column mapping
│   ├── validate/      # Validation
│   └── execute/       # Import execution
├── data/              # Imported data CRUD
├── ai/                # AI operations
│   ├── assistant/     # AI Assistant chat
│   ├── mapping/       # AI column mapping
│   ├── validate/      # AI validation
│   └── detect/        # Duplicate detection
├── subscriptions/     # Subscription management
├── billing/           # Billing & invoices
├── notifications/     # Notification preferences & history
├── files/             # File storage & retrieval
└── admin/             # Super Admin endpoints
    ├── organizations/
    ├── plans/
    ├── features/
    ├── billing/
    ├── analytics/
    ├── audit/
    └── settings/
```

### 14.3 API Versioning

- URL-based versioning (`/api/v1/`, `/api/v2/`)
- Minimum 12 months support for deprecated versions
- Deprecation header (`Sunset: Sat, 01 Jan 2028 00:00:00 GMT`) on deprecated endpoints
- Migration guides published per version change

### 14.4 Pagination

Cursor-based pagination for list endpoints:

```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJpZCI6MTB9",
    "has_more": true,
    "next_cursor": "eyJpZCI6MjB9"
  }
}
```

### 14.5 Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address",
        "code": "INVALID_FORMAT"
      }
    ],
    "request_id": "req_abc123",
    "documentation_url": "https://docs.erpx.io/api/errors#VALIDATION_ERROR"
  }
}
```

### 14.6 Rate Limiting

- Rate limits returned in response headers (`X-RateLimit-*`)
- Three tiers: Free (100/hr), Growth (1000/hr), Business (10000/hr), Enterprise (custom)
- Per-endpoint granular limits for expensive operations (AI endpoints)
- Burst allowance for short-term spikes

### 14.7 WebSocket API

For real-time features:

- Import progress streaming
- Live notifications
- AI Assistant streaming responses
- Connection authenticated via JWT handshake
- Automatic reconnection with exponential backoff

---

## 15. Folder Structure

### 15.1 Monorepo Structure

```
erpx/
├── apps/
│   ├── api/                    # Backend API (NestJS/Node.js)
│   │   ├── src/
│   │   │   ├── modules/        # Domain modules (auth, billing, imports...)
│   │   │   ├── common/         # Shared utilities, guards, interceptors
│   │   │   ├── config/         # Configuration management
│   │   │   ├── database/       # Prisma schema, migrations, seeds
│   │   │   └── main.ts         # Entry point
│   │   └── test/
│   ├── web/                    # Customer Portal (Next.js)
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   ├── components/     # Shared components
│   │   │   ├── lib/            # Utilities, API client
│   │   │   └── hooks/          # React hooks
│   │   └── public/
│   └── admin/                  # Super Admin Panel (Next.js)
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   └── lib/
│       └── public/
│
├── packages/
│   ├── shared/                 # Shared types, validation schemas
│   ├── ui/                     # Shared UI component library
│   ├── config/                 # Shared configuration
│   └── eslint-config/          # Shared ESLint configuration
│
├── services/
│   ├── ai-orchestrator/        # AI Gateway service
│   ├── notification-worker/    # Background notification processor
│   ├── billing-worker/         # Background billing processor
│   └── import-worker/          # Background import processor
│
├── infrastructure/
│   ├── terraform/              # Infrastructure as code
│   ├── docker/                 # Docker configurations
│   ├── kubernetes/             # K8s manifests
│   └── scripts/                # Deployment and maintenance scripts
│
├── docs/                       # Architecture and technical documentation
│   ├── api/                    # API documentation
│   ├── architecture/           # Architecture decision records
│   └── guides/                 # Developer guides
│
├── tools/                      # Internal CLI tools and utilities
├── .github/                    # GitHub Actions workflows
├── .vscode/                    # Workspace settings
├── package.json                # Root workspace config
├── turbo.json                  # Turborepo configuration
└── README.md
```

### 15.2 API Module Structure (per domain)

```
modules/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/             # Passport strategies
│   ├── guards/                 # Auth guards
│   ├── dto/                    # Request/response DTOs
│   └── test/
├── billing/
│   ├── billing.module.ts
│   ├── billing.controller.ts
│   ├── billing.service.ts
│   ├── processors/             # Razorpay, Stripe integrations
│   ├── webhooks/               # Payment gateway webhooks
│   ├── dto/
│   └── test/
├── imports/
│   ├── import.module.ts
│   ├── import.controller.ts
│   ├── import.service.ts
│   ├── parsers/                # File type parsers (CSV, XLSX, PDF)
│   ├── pipeline/               # Import processing pipeline stages
│   ├── dto/
│   └── test/
└── ... (per domain module)
```

### 15.3 Common Layer

```
common/
├── decorators/                 # Custom decorators (CurrentUser, Roles...)
├── filters/                    # Exception filters
├── guards/                     # Shared guards (TenantGuard, ThrottlerGuard)
├── interceptors/               # Logging, transformation, tenant context
├── pipes/                      # Validation pipes
├── middleware/                  # Tenant resolution, request logging
├── interfaces/                 # Common interfaces
├── constants/                  # System constants
└── utils/                      # Utility functions
```

---

## 16. Security Architecture

### 16.1 Authentication

- **JWT-based** access tokens (short-lived, 15 minutes)
- **Refresh tokens** (long-lived, 7 days) with rotation
- **OAuth2.0** for social login (Google, GitHub, Microsoft)
- **SSO/SAML** for Enterprise tier (Okta, Azure AD, OneLogin)
- **MFA** support via TOTP (optional, configurable per org)
- **Session invalidation** on password change, role change, or admin action

### 16.2 Authorization

- **RBAC (Role-Based Access Control)** at organization level
- Predefined roles: Owner, Admin, Member, Viewer
- Custom roles for Business+ plans
- Permission checks enforced at controller level via guards
- Row-level permissions for data access within organizations

### 16.3 API Security

- All traffic over TLS 1.3
- API key authentication for programmatic access
- CORS configured per environment
- Request validation (JSON Schema / Zod)
- SQL injection prevention via ORM (Prisma)
- No sensitive data in URL parameters

### 16.4 Tenant Isolation

| Layer | Isolation Mechanism |
|---|---|
| Application | Tenant context middleware sets org_id on every request |
| Database | Row-level security policies enforce org_id filter |
| Cache | Keys prefixed with org_id |
| File Storage | S3 paths prefixed with org_id |
| Queue | RabbitMQ virtual hosts per tenant (Enterprise) |

### 16.5 Data Protection

- Encryption at rest (AES-256) for all stored data
- Encryption in transit (TLS 1.3)
- Field-level encryption for PII (phone numbers, addresses)
- Sensitive data masking in logs (credit cards, passwords)
- Hashing for passwords (bcrypt, cost factor 12)
- Encryption for API keys (AES-256-GCM)

### 16.6 Audit Logging

- Immutable audit trail for all security-relevant events
- Events logged: login, logout, failed auth, role change, data export, API key create/revoke
- Structured log format with correlation IDs
- Logs retained for 365 days
- Tamper-evident log storage (hash chain)

### 16.7 Rate Limiting

- Global rate limit per IP (1000 req/min)
- Per-endpoint rate limits (auth: 10/min, AI: 30/min)
- Rate limit headers on all responses
- Gradual backoff on repeated violations
- Admin override for legitimate high-volume usage

### 16.8 Security Headers

```
Content-Security-Policy: default-src 'self'; ...
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 16.9 Vulnerability Management

- Automated dependency scanning (Dependabot/Renovate)
- SAST in CI pipeline (CodeQL/SonarQube)
- DAST on staging environment
- Penetration testing before major releases
- Responsible disclosure policy with bug bounty program

---

## 17. Scaling Strategy

### 17.1 Horizontal Scaling

| Component | Scaling Strategy |
|---|---|
| API Servers | Stateless; scale via horizontal pod autoscaling (CPU/memory) |
| Web Frontends | CDN caching; static asset caching; scale horizontally |
| Worker Services | Queue-based; scale based on queue depth |
| Database | Read replicas for query offloading; connection pooling (PgBouncer) |
| Redis | Redis Cluster for horizontal partitioning |
| RabbitMQ | Clustered deployment with mirrored queues |

### 17.2 Database Scaling

- **Read replicas:** 2-3 replicas for read-heavy workloads (dashboard, reporting)
- **Connection pooling:** PgBouncer with transaction-level pooling
- **Query optimization:** Index tuning, materialized views for analytics
- **Partitioning:** Time-based partitioning for logs and audit data
- **Connection limits:** Per-tenant connection pooling to prevent noisy neighbor

### 17.3 Caching Strategy

| Cache | What | TTL | Eviction |
|---|---|---|---|
| Redis (App) | Feature flags, plan entitlements | 5 min | LRU |
| Redis (Session) | User sessions, rate limit counters | Session-based | TTL expiry |
| Redis (Queue) | Background job queue | N/A | Completed jobs removed |
| CDN | Static assets, API responses (GET only) | 10-60 min | Cache purge on deploy |
| In-memory | Reference data (plans, features) | 1 min | Time-based refresh |

### 17.4 Job Queue Architecture

- **RabbitMQ** for durable, reliable message delivery
- **Priority queues** for time-sensitive operations (billing > import > notification)
- **Dead-letter queues** for failed messages after retry exhaustion
- **Delayed queues** for scheduled operations (dunning, reminders)
- **Worker pools** per queue type with configurable concurrency

### 17.5 Data Archival

- Active data in PostgreSQL (current + 90 days)
- Warm data in PostgreSQL (partitioned, compressed)
- Cold data in S3/Glacier (compressed, columnar format)
- Archive triggered by cron jobs via the archive service

---

## 18. Multi-Tenancy Strategy

### 18.1 Tenant Identification

- Tenant resolved from the authenticated user's organization membership
- API requests include tenant context implicitly via auth token
- Subdomain-based routing for Enterprise tier (`tenant.erpx.io`)
- All services receive tenant context via request-scoped context propagation

### 18.2 Tenant Lifecycle

```
Signup → Organization Created → Trial Provisioned → Active
                         ↓ (if needed)
              Approval Required (Enterprise)
                         ↓
              Manual Verification by Admin
                         ↓
                     Active → Canceled → Suspended → Deleted
```

### 18.3 Tenant Isolation Levels

| Aspect | Free / Growth | Business | Enterprise |
|---|---|---|---|
| Database | Row-level (org_id) | Row-level + partitions | Schema-per-tenant |
| Cache | Key prefix (org_id) | Key prefix | Dedicated Redis instance |
| File Storage | Prefix path (org_id) | Prefix path | Dedicated bucket |
| Compute | Shared | Shared (reserved min) | Dedicated instances |
| Queue | Shared queues | Shared queues | Dedicated queues |

### 18.4 Onboarding Flow

1. User signs up with email/password or OAuth
2. New organization created with Free plan
3. Trial activated if signing up for Growth/Business
4. Welcome email sent with getting-started guide
5. Default team (owner role) created
6. Usage tracking begins immediately
7. Feature flags evaluated against Free plan entitlements

### 18.5 Cross-Tenant Operations (Admin Only)

- Super Admin can view any tenant's data with explicit audit logging
- Tenant impersonation records every action in audit log
- Cross-tenant analytics aggregated via reporting service
- No direct inter-tenant data access from application code

### 18.6 Tenant Deletion

- Initiated by customer (self-serve) or admin (manual)
- 30-day grace period for data recovery
- During grace: data inaccessible to users, but preserved
- After 30 days: schema dropped, files deleted, cache purged
- Audit records retained indefinitely (anonymized)
- Billing records retained for legal compliance

---

## 19. Future Roadmap

### Phase 1 — Foundation (Current Sprint)

- [x] Core API framework with multi-tenancy
- [x] Authentication system with JWT/OAuth2
- [x] Prisma database schema and migrations
- [x] Base permissions system
- [ ] SaaS subscription infrastructure
- [ ] Feature flag system
- [ ] Usage limit system

### Phase 2 — Core SaaS (Next)

- Billing integration (Razorpay + Stripe)
- Customer Portal dashboard
- Team management and invitations
- Notification system (email + in-app)
- Admin Panel — Organization and Plan management
- Audit logging system

### Phase 3 — AI Platform

- AI Gateway with provider abstraction
- Excel/CSV/PDF import pipeline
- AI column mapping engine
- Data validation engine
- Duplicate detection with embeddings

### Phase 4 — Advanced Features

- AI Assistant (conversational interface)
- Natural language data queries
- OCR pipeline for scanned PDFs
- Smart validation rules
- Custom template management

### Phase 5 — Enterprise & Scale

- SSO/SAML integration
- Schema-per-tenant isolation
- Dedicated infrastructure provisioning
- Advanced analytics and reporting
- API marketplace for integrations

### Phase 6 — Platform Maturity

- Web Push notifications
- WhatsApp notification channel
- Workflow automation engine
- Advanced revenue analytics (MRR, churn, LTV)
- Mobile application
- Public API with developer portal
- Marketplace for plugins and integrations

---

## Appendix A: Architecture Decision Records

| ADR | Decision | Rationale |
|---|---|---|
| ADR-001 | NestJS as API framework | Modular architecture, built-in DI, strong typing, mature ecosystem |
| ADR-002 | Prisma as ORM | Type-safe queries, migration management, excellent PostgreSQL support |
| ADR-003 | Hybrid tenancy model | Balance between cost efficiency (shared) and isolation requirements (dedicated) |
| ADR-004 | RabbitMQ over Kafka | Prioritizing reliable delivery and delayed queues over throughput |
| ADR-005 | REST + WebSocket over GraphQL | Simpler caching, broader client compatibility, sufficient for use case |
| ADR-006 | Pluggable AI gateway | Avoid vendor lock-in; ability to use best model per task |

---

## Appendix B: Glossary

| Term | Definition |
|---|---|
| Tenant / Organization | A distinct customer entity with isolated data and configuration |
| Plan / Tier | A subscription level defining feature access and usage limits |
| Feature Flag | A boolean toggle controlling feature availability per organization |
| Usage Limit | A numeric quota on a tracked resource (storage, imports, users) |
| MRR | Monthly Recurring Revenue |
| Dunning | Automated payment recovery workflow for failed charges |
| AI Gateway | Abstraction layer between ERPX services and AI provider APIs |
| OCR | Optical Character Recognition — extracting text from images/scans |
| RBAC | Role-Based Access Control |
| Tenant Isolation | Mechanisms preventing data leakage between organizations |

---

## Appendix C: External Integrations

| System | Purpose | Integration Pattern |
|---|---|---|
| Razorpay | Payment processing (India) | Webhook + Server-side SDK |
| Stripe | Payment processing (Global) | Webhook + Server-side SDK |
| OpenAI | LLM for AI features | REST API via AI Gateway |
| Anthropic | Alternative LLM provider | REST API via AI Gateway |
| Resend (or SES) | Transactional email | SMTP / REST API |
| Slack | Admin notifications | Webhook |
| Sentry | Error tracking | SDK |
| DataDog (or Grafana) | Observability | Agent + Exporter |
| S3 (MinIO) | File storage | SDK |
| Redis | Cache / Session / Rate Limiting | Client library |
| RabbitMQ | Message queue | Client library |

---

*This document is the official architecture blueprint for the ERPX SaaS Platform. All development work must align with the patterns, principles, and decisions documented herein. Deviations require an approved Architecture Decision Record (ADR).*

---
