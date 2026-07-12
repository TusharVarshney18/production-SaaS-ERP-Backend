# Sprint 5.1 — Sales Quotation Management

## Overview

Complete Quotation Management module with full CRUD, status state machine, pricing engine, audit logging, organization isolation, and RBAC.

## Files Created/Modified

### Prisma Schema (`prisma/schema.prisma`)

- **Added enum**: `QuotationStatus` (DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED, CANCELLED)
- **Added model**: `Quotation` — core quotation entity with auto-generated number, pricing fields, soft delete
- **Added model**: `QuotationItem` — line items with quantity, pricing, discount, tax
- **Added model**: `QuotationTimeline` — event history per quotation
- **Updated models**: `Organization`, `Company`, `Contact`, `Deal`, `User`, `Product` — added back-references

### New Module: `src/sales/`

| File | Description |
|---|---|
| `sales.module.ts` | NestJS module wiring |
| `pricing.service.ts` | **Reusable pricing engine** — shared service for all future pricing needs |
| `quotation.controller.ts` | 20 REST endpoints |
| `quotation.service.ts` | Full business logic — CRUD, status machine, items, timeline |
| `dto/create-quotation.dto.ts` | Create DTO with validation + Swagger |
| `dto/update-quotation.dto.ts` | Partial update DTO |
| `dto/quotation-query.dto.ts` | Search, filter, pagination DTO |
| `dto/create-quotation-item.dto.ts` | Line item creation |
| `dto/update-quotation-item.dto.ts` | Line item update |
| `dto/reorder-items.dto.ts` | Item reorder payload |
| `dto/quotation-status.dto.ts` | Send/Accept/Reject/Cancel DTOs |
| `__tests__/pricing.service.spec.ts` | 8 tests |
| `__tests__/quotation.service.spec.ts` | 13 tests |
| `__tests__/quotation.controller.spec.ts` | 18 tests |

### Modified Files

| File | Change |
|---|---|
| `src/app.module.ts` | Added `SalesModule` import |

## API Endpoints

All under `/sales/organizations/:orgId`

### Quotation CRUD

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/quotations` | `quotation:create` | Create with items |
| GET | `/quotations` | `quotation:read` | List with search/filter/pagination |
| GET | `/quotations/:id` | `quotation:read` | Get with items + timeline |
| PATCH | `/quotations/:id` | `quotation:update` | Update (draft only) |
| POST | `/quotations/:id/archive` | `quotation:update` | Soft archive |
| POST | `/quotations/:id/restore` | `quotation:update` | Restore from archive |
| DELETE | `/quotations/:id` | `quotation:delete` | Soft delete |

### Status Transitions

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/quotations/:id/send` | `quotation:send` | DRAFT → SENT |
| POST | `/quotations/:id/accept` | `quotation:accept` | SENT/VIEWED → ACCEPTED |
| POST | `/quotations/:id/reject` | `quotation:reject` | SENT/VIEWED → REJECTED |
| POST | `/quotations/:id/cancel` | `quotation:cancel` | Any → CANCELLED |
| POST | `/quotations/:id/duplicate` | `quotation:create` | Create copy |

### Items

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/quotations/:id/items` | `quotation:update` | Add line item |
| PATCH | `/quotations/:id/items/:itemId` | `quotation:update` | Update line item |
| DELETE | `/quotations/:id/items/:itemId` | `quotation:update` | Remove line item |
| POST | `/quotations/:id/items/reorder` | `quotation:update` | Reorder items |

### Timeline

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/quotations/:id/timeline` | `quotation:read` | Paginated timeline |

### Search & Filters

- Search by quotation number
- Filter by: status, company, contact, owner, issue date range, expiry date range
- Pagination: `page`, `limit`, `sortBy`, `sortOrder`

## Pricing Engine (`PricingService`)

Reusable service with:
- `calculateLineItem()` — computes line total, item-level discount, tax
- `calculateSummary()` — aggregates subtotal, applies header discount, computes grand total
- `validateCalculations()` — validates integrity of pricing results

Supports:
- Item-level percentage discount
- Header-level `PERCENTAGE` or `FIXED_AMOUNT` discount
- Per-item tax rate
- Flat shipping amount

**Future modules must reuse this service** instead of duplicating pricing logic.

## Status State Machine

```
DRAFT ──► SENT ──► VIEWED ──► ACCEPTED
  │                   │           │
  │                   ├──► REJECTED
  │                   ├──► EXPIRED
  └─────► CANCELLED ◄─┴───────────┘
```

Invalid transitions throw `BadRequestException`.

## Security

- **Organization isolation**: All queries scoped by `organizationId`
- **RBAC**: Fine-grained permissions (`quotation:create`, `quotation:read`, `quotation:update`, `quotation:delete`, `quotation:send`, `quotation:accept`, `quotation:reject`, `quotation:cancel`)
- **Audit logging**: Every mutation recorded via `AuditLogService`
- **DTO validation**: `class-validator` decorators on all DTOs
- **Swagger**: `@ApiTags`, `@ApiOperation`, `@ApiProperty` on all endpoints/DTOs

## Verification Results

```
✓ npm run build          — clean
✓ npm run lint           — clean (0 errors)
✓ npm test               — 542 passed, 41 suites
✓ npx prisma validate    — valid
```

## Architecture Review

### Code Duplication Review

- **Low duplication**. The module follows the established pattern from CRM/Deals modules (controller→service→dto pattern, timeline + audit logging helpers).
- **Pricing logic** is extracted into `PricingService` and is not duplicated.

### Shared Service Opportunities

1. **`PricingService`** — Already designed as injectable, reusable for Sales Orders (Sprint 5.2), Invoices, and future modules.
2. **Status state machine pattern** — The `VALID_TRANSITIONS` map pattern could be extracted into a shared utility for all stateful entities.

### Technical Debt Introduced

1. **Quotation number generation** — Currently uses `count + 1` which can have gaps. For high-volume production, consider a dedicated sequence table or database sequence.
2. **Item recalculate on update** — Deletes and recreates all items on update instead of diffing. Fine for moderate sizes but could be optimized for large quotations.
3. **No email/SMS notification on send** — The `send` endpoint transitions status but does not actually dispatch the quotation. Requires integration with a notification service.

### Suggested Refactoring Before Sprint 5.2

1. **Create shared state machine utility** — Extract the `VALID_TRANSITIONS` pattern + `validateStatusTransition()` into `common/utils/state-machine.util.ts` for reuse in Sales Orders.
2. **Create `@OwnedEntity()` decorator** — Many services repeat the `findFirst({ where: { id, organizationId } })` pattern. A shared decorator or base service could reduce boilerplate.
3. **Move `PricingService` to `common/services/`** — Make it more discoverable for future modules.
4. **Standardize audit log helper** — All services define identical `log()` helpers. A shared mixin or base class would eliminate this repetition across all modules.
