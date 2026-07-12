# Sprint 5.2 — Sales Order Management

## Overview

Complete Sales Order Management module with full CRUD, quotation conversion, status state machine, pricing engine reuse, audit logging, organization isolation, RBAC, and future hook interfaces.

## Files Created/Modified

### Prisma Schema (`prisma/schema.prisma`)

- **Added enum**: `SalesOrderStatus` (DRAFT, CONFIRMED, PROCESSING, PARTIALLY_FULFILLED, FULFILLED, CANCELLED)
- **Added model**: `SalesOrder` — core order entity with auto-generated number, pricing fields, soft delete, quotation link
- **Added model**: `SalesOrderItem` — line items with quantity, pricing, discount, tax
- **Added model**: `SalesOrderTimeline` — event history per order
- **Updated models**: `Organization`, `Company`, `Contact`, `Deal`, `User`, `Product`, `Quotation` — added back-references

### New Module: `src/sales/orders/`

| File | Description |
|---|---|
| `sales-orders.module.ts` | NestJS module wiring |
| `sales-orders.controller.ts` | 14 REST endpoints |
| `sales-orders.service.ts` | Full business logic — CRUD, quotation conversion, status machine, timeline |
| `interfaces/inventory-reservation.interface.ts` | Future hook: inventory reservation contract |
| `interfaces/shipment.interface.ts` | Future hook: shipment contract |
| `interfaces/invoice-generation.interface.ts` | Future hook: invoice generation contract |
| `dto/create-sales-order.dto.ts` | Create DTO with validation + Swagger |
| `dto/create-sales-order-item.dto.ts` | Line item creation DTO |
| `dto/update-sales-order.dto.ts` | Partial update DTO |
| `dto/sales-order-query.dto.ts` | Search, filter, pagination DTO |
| `dto/sales-order-status.dto.ts` | Confirm/Cancel DTOs |
| `__tests__/sales-orders.service.spec.ts` | 24 tests — CRUD, conversion, transitions, pricing reuse, isolation |
| `__tests__/sales-orders.controller.spec.ts` | 10 tests — delegation |

### Modified Files

| File | Change |
|---|---|
| `src/app.module.ts` | Added `SalesOrdersModule` import |

## Reused Components

- **`PricingService`** (`src/sales/pricing.service.ts`) — All pricing calculations reuse this service; no pricing logic duplicated
- **Authentication** — `JwtAuthGuard`
- **RBAC** — `PermissionGuard` + `@Permissions()` decorator
- **Audit Logs** — `AuditLogService` for all mutations
- **CRM** — Linked to Company, Contact, Deal
- **Product Catalog** — Linked to Product via items
- **Quotation Module** — `convertFromQuotation` creates orders from accepted quotations
- **Common utilities** — Request ID middleware, transform interceptor, exception filter

## API Endpoints

All under `/sales/organizations/:orgId`

### CRUD

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/orders` | `sales_order:create` | Create with items |
| GET | `/orders` | `sales_order:read` | List with search/filter/pagination |
| GET | `/orders/:id` | `sales_order:read` | Get with items + timeline |
| PATCH | `/orders/:id` | `sales_order:update` | Update (draft only) |
| POST | `/orders/:id/archive` | `sales_order:update` | Soft archive |
| POST | `/orders/:id/restore` | `sales_order:update` | Restore from archive |
| DELETE | `/orders/:id` | `sales_order:delete` | Soft delete |

### Quotation Conversion

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/orders/from-quotation/:quotationId` | `sales_order:create` | Convert accepted quotation to order |

### Status Transitions

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/orders/:id/confirm` | `sales_order:confirm` | DRAFT → CONFIRMED |
| POST | `/orders/:id/cancel` | `sales_order:cancel` | Any → CANCELLED |
| POST | `/orders/:id/status` | `sales_order:update` | Generic status change |
| POST | `/orders/:id/duplicate` | `sales_order:create` | Create copy |

### Timeline

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/orders/:id/timeline` | `sales_order:read` | Paginated timeline |

### Search & Filters

- Search by order number
- Filter by: status, company, contact, owner, order date range
- Pagination: `page`, `limit`, `sortBy`, `sortOrder`

## Status State Machine

```
DRAFT ──► CONFIRMED ──► PROCESSING ──► PARTIALLY_FULFILLED ──► FULFILLED
  │           │              │                  │                  │
  └─────► CANCELLED ◄────────┴──────────────────┴──────────────────┘
```

Invalid transitions throw `BadRequestException`.

## Quotation → Order Conversion

- Only `ACCEPTED` quotations can be converted
- Prevents duplicate conversion (one order per quotation)
- Copies items, pricing, company, contact, deal from quotation
- Links back to the quotation via `quotationId`
- Records `order.converted_from_quotation` in timeline

## Future Hook Interfaces

Prepared but not implemented:

| Interface | Purpose |
|---|---|
| `IInventoryReservationService` | Reserve stock on confirm/fulfill |
| `IShipmentService` | Create/cancel shipments against orders |
| `IInvoiceGenerationService` | Generate invoices from fulfilled orders |

## Security

- **Organization isolation**: All queries scoped by `organizationId`
- **RBAC**: Fine-grained permissions (`sales_order:create`, `:read`, `:update`, `:delete`, `:confirm`, `:cancel`)
- **Audit logging**: Every mutation recorded via `AuditLogService`
- **DTO validation**: `class-validator` decorators on all DTOs
- **Swagger**: Full `@ApiTags`, `@ApiOperation`, `@ApiProperty` decoration

## Verification Results

```
✓ npm run build          — clean
✓ npm run lint           — clean (0 errors)
✓ npm test               — 576 passed, 43 suites
✓ npx prisma validate    — valid
```

## Architecture Review

### Code Duplication Review

- **Very low duplication**. The module follows the established pattern from Quotations module.
- **Pricing logic** is fully delegated to `PricingService` — zero duplication.
- The `SalesOrdersService` shares the same helper patterns (`recordTimeline`, `log`, `findOrderOrThrow`, `validateStatusTransition`, `recalculateAndUpdate`, `generateOrderNumber`) as `QuotationService`.

### Shared Service Opportunities

1. **`PricingService`** — Fully reused. No additional extraction needed.
2. **State machine pattern** — The `VALID_TRANSITIONS` map is duplicated in `QuotationService` and `SalesOrdersService`. A shared state machine utility would eliminate this duplication.
3. **Sequence generation** — `generateOrderNumber` and `generateQuotationNumber` are near-identical. A shared `SequenceService` would DRY this up.

### Technical Debt Introduced

1. **Quotation conversion limitation** — Currently only handles one order per quotation. Future requirement may allow partial conversion (split quotation into multiple orders).
2. **No inventory check** — The `confirm` transition does not reserve inventory (future hook prepared but not wired).
3. **Item replacement on update** — Deletes and recreates all items on update instead of diffing. Adequate for moderate sizes but could be optimized.

### Suggested Refactoring Before Sprint 5.3

1. **Extract `StateMachineUtil`** — Create `src/common/utils/state-machine.util.ts` with a generic state transition validator that all stateful entities reuse.
2. **Extract `SequenceService`** — Create `src/common/services/sequence.service.ts` with organization-scoped sequence generation (`QTN-`, `ORD-`, `INV-`, etc.).
3. **Move future hooks to implementations** — Inventory reservation (on confirm), invoice generation (on fulfill) — wire the prepared interfaces into the relevant status transitions.
4. **Base `CrudService` class** — All services (Products, Contacts, Deals, Quotations, Orders) repeat the `findFirst({id, organizationId})` pattern. A generic base service for org-scoped CRUD would eliminate significant boilerplate across the codebase.
