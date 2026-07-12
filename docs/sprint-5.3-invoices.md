# Sprint 5.3 — Invoice Management

## Overview

Complete Sales Invoice Management module with full CRUD, sales order conversion, status state machine, dual-status tracking (lifecycle + payment), PricingService reuse, audit logging, organization isolation, RBAC, and future hook interfaces.

## Files Created/Modified

### Prisma Schema (`prisma/schema.prisma`)

- **Added enum**: `SalesInvoiceStatus` (DRAFT, SENT, VIEWED, PARTIALLY_PAID, PAID, VOID)
- **Added enum**: `InvoicePaymentStatus` (UNPAID, PARTIALLY_PAID, PAID, OVERDUE, REFUNDED)
- **Added model**: `SalesInvoice` — core invoice entity with auto-generated number, dual status, amount tracking, soft delete, order/quotation links
- **Added model**: `SalesInvoiceItem` — line items with quantity, pricing, discount, tax
- **Added model**: `SalesInvoiceTimeline` — event history per invoice
- **Updated models**: `Organization`, `SalesOrder`, `Quotation`, `Company`, `Contact`, `User`, `Product` — added back-references
- **Note**: Uses `SalesInvoice` model name to avoid conflict with existing billing `Invoice` model

### New Module: `src/invoices/`

| File | Description |
|---|---|
| `invoices.module.ts` | NestJS module wiring |
| `invoices.controller.ts` | 13 REST endpoints |
| `invoices.service.ts` | Full business logic — CRUD, order conversion, status machine, dual-status management, timeline |
| `interfaces/payment-allocation.interface.ts` | Future hook: payment allocation contract |
| `interfaces/credit-note.interface.ts` | Future hook: credit notes contract |
| `interfaces/recurring-invoice.interface.ts` | Future hook: recurring invoice contract |
| `dto/create-invoice.dto.ts` | Create DTO with validation + Swagger |
| `dto/create-invoice-item.dto.ts` | Line item creation DTO |
| `dto/update-invoice.dto.ts` | Partial update DTO |
| `dto/invoice-query.dto.ts` | Search, filter, pagination DTO |
| `dto/invoice-status.dto.ts` | Send/Void DTOs |
| `__tests__/invoices.service.spec.ts` | 24 tests — CRUD, conversion, transitions, pricing reuse, isolation |
| `__tests__/invoices.controller.spec.ts` | 10 tests — delegation |

### Modified Files

| File | Change |
|---|---|
| `src/app.module.ts` | Added `InvoicesModule` import |

## Reused Components

- **`PricingService`** (`src/sales/pricing.service.ts`) — All pricing calculations reuse this service
- **Authentication** — `JwtAuthGuard`
- **RBAC** — `PermissionGuard` + `@Permissions()` decorator
- **Audit Logs** — `AuditLogService` for all mutations
- **Sales Orders** — `createFromSalesOrder` generates invoices from fulfilled orders
- **CRM** — Linked to Company, Contact
- **Product Catalog** — Linked to Product via items

## API Endpoints

All under `/sales/organizations/:orgId`

### CRUD

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/invoices` | `invoice:create` | Create with items |
| GET | `/invoices` | `invoice:read` | List with search/filter/pagination |
| GET | `/invoices/:id` | `invoice:read` | Get with items + timeline |
| PATCH | `/invoices/:id` | `invoice:update` | Update (draft only) |
| POST | `/invoices/:id/archive` | `invoice:update` | Soft archive |
| POST | `/invoices/:id/restore` | `invoice:update` | Restore from archive |
| DELETE | `/invoices/:id` | `invoice:delete` | Soft delete |

### Sales Order Conversion

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/invoices/from-order/:salesOrderId` | `invoice:create` | Generate from fulfilled order |

### Status Transitions

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/invoices/:id/send` | `invoice:send` | DRAFT → SENT |
| POST | `/invoices/:id/void` | `invoice:void` | Any → VOID |
| POST | `/invoices/:id/duplicate` | `invoice:create` | Create copy |

### Timeline

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/invoices/:id/timeline` | `invoice:read` | Paginated timeline |

### Search & Filters

- Search by invoice number
- Filter by: status, payment status, company, contact, owner, issue date range, due date range

## Status State Machine

```
DRAFT ──► SENT ──► VIEWED ──► PARTIALLY_PAID ──► PAID
  │         │         │              │              │
  └─────► VOID ◄─────┴──────────────┴──────────────┘
```

## Dual-Status Tracking

- **`status`** — Document lifecycle (DRAFT → SENT → VIEWED → PARTIALLY_PAID → PAID → VOID)
- **`paymentStatus`** — Payment state (UNPAID → PARTIALLY_PAID → PAID → OVERDUE → REFUNDED)
- **`amountPaid` / `balanceDue`** — Payment amount tracking (updated by future payment allocation)

## Sales Order → Invoice Conversion

- Only `FULFILLED` orders can be invoiced
- Prevents duplicate invoicing (one invoice per order)
- Copies items, pricing, company, contact from order
- Links back via `salesOrderId`
- Sets 30-day net payment terms by default
- Records `invoice.generated_from_order` in timeline

## Future Hook Interfaces

| Interface | Purpose |
|---|---|
| `IPaymentAllocationService` | Allocate payments against invoices, update amountPaid/balanceDue |
| `ICreditNoteService` | Create credit notes against invoices |
| `IRecurringInvoiceService` | Configure and generate recurring invoices |

## Security

- **Organization isolation**: All queries scoped by `organizationId`
- **RBAC**: Permissions (`invoice:create`, `:read`, `:update`, `:delete`, `:send`, `:void`)
- **Audit logging**: Every mutation recorded via `AuditLogService`
- **DTO validation**: `class-validator` on all DTOs
- **Swagger**: Full Swagger decoration

## Verification Results

```
✓ npm run build          — clean
✓ npm run lint           — clean (0 errors)
✓ npm test               — 610 passed, 45 suites
✓ npx prisma validate    — valid
```

## Architecture Review

### Code Duplication Review

- **Very low duplication**. All pricing logic delegates to `PricingService`.
- Follows the same patterns as Quotations (Sprint 5.1) and Sales Orders (Sprint 5.2).
- The `SalesInvoice` model name distinguishes from the billing module's `Invoice`.

### Shared Service Opportunities

1. **`PricingService`** — Reused across Quotations, Sales Orders, and Invoices. Ready for any future module.
2. **State machine pattern** — `VALID_TRANSITIONS` maps now exist in 3 services. A shared utility would eliminate this.
3. **Sequence generation** — `generateInvoiceNumber`, `generateOrderNumber`, `generateQuotationNumber` are identical.

### Technical Debt Introduced

1. **Dual `Invoice` models** — The billing module has its own `Invoice` model. A future refactor could unify them, but the current separation avoids coupling subscription billing with sales invoicing.
2. **Payment allocation not wired** — `amountPaid`/`balanceDue` are initialized but only updated by the future `IPaymentAllocationService`.
3. **Item replacement on update** — Deletes and recreates all items on update instead of diffing.

### Suggested Refactoring Before Sprint 6.0

1. **Extract `StateMachineUtil`** — Generic state transition validator for all stateful entities.
2. **Extract `SequenceService`** — Shared sequence generation for all document numbers.
3. **Create `BaseCrudService`** — Generic base class for org-scoped CRUD operations to eliminate the repeated `findFirst({id, organizationId})` + NotFoundException pattern across all 20+ services.
4. **Consider unifying Invoice models** — Evaluate whether the billing `Invoice` and `SalesInvoice` can share a base, but only if the coupling is justified.
5. **Wire payment allocation** — Implement `IPaymentAllocationService` so invoice payment status is automatically updated.
