# Sprint 6 — Inventory Management

## Overview

Complete Inventory Management module for the ERPX platform, providing warehouse management, stock control, inventory transfers, and stock ledger tracking.

## Module Structure

```
src/inventory/
├── inventory.module.ts          # Root module
├── inventory.controller.ts      # Dashboard & search endpoints
├── inventory.service.ts         # Dashboard aggregation & search logic
├── warehouse/
│   ├── warehouse.module.ts
│   ├── warehouse.controller.ts
│   ├── warehouse.service.ts     # CRUD, archive, restore, soft-delete
│   ├── dto/
│   │   ├── create-warehouse.dto.ts
│   │   ├── update-warehouse.dto.ts
│   │   └── warehouse-query.dto.ts
│   └── __tests__/
│       └── warehouse.service.spec.ts
├── stock/
│   ├── stock.module.ts
│   ├── stock.controller.ts
│   ├── stock.service.ts         # Reserve, release, adjust, increase, decrease, ledger
│   ├── dto/
│   │   ├── reserve-stock.dto.ts
│   │   ├── release-stock.dto.ts
│   │   ├── adjust-stock.dto.ts
│   │   └── stock-query.dto.ts
│   └── __tests__/
│       └── stock.service.spec.ts
├── transfer/
│   ├── transfer.module.ts
│   ├── transfer.controller.ts
│   ├── transfer.service.ts      # Create, approve, complete, cancel
│   ├── dto/
│   │   ├── create-transfer.dto.ts
│   │   └── transfer-query.dto.ts
│   └── __tests__/
│       └── transfer.service.spec.ts
└── __tests__/
```

## Prisma Models

### Warehouse
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organizationId | UUID | Tenant isolation |
| code | String | Unique per org |
| name | String | |
| description | String? | |
| address | String? | |
| managerId | UUID? | FK to User |
| isDefault | Boolean | |
| status | WarehouseStatus | ACTIVE / INACTIVE |
| deletedAt | DateTime? | Soft delete |

### Stock
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organizationId | UUID | Tenant isolation |
| warehouseId | UUID | FK to Warehouse |
| productId | UUID | FK to Product |
| availableQty | Int | |
| reservedQty | Int | |
| damagedQty | Int | |
| reorderLevel | Int | |
| maxLevel | Int | |
| **Unique** | | warehouseId + productId |

### StockLedger
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organizationId | UUID | Tenant isolation |
| warehouseId | UUID | |
| productId | UUID | |
| transactionType | StockTransactionType | PURCHASE, SALE, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT, RETURN, RESERVATION, RELEASE |
| referenceType | String | SalesOrder, PurchaseOrder, Manual, Adjustment, Transfer |
| referenceId | String? | |
| quantity | Int | Signed delta |
| previousQty | Int | |
| newQty | Int | |
| createdBy | String | User ID |

### InventoryTransfer
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organizationId | UUID | |
| fromWarehouseId | UUID | |
| toWarehouseId | UUID | |
| status | TransferStatus | DRAFT → IN_TRANSIT → COMPLETED |
| notes | String? | |
| createdBy/approvedBy/completedBy/cancelledBy | String? | |
| completedAt/cancelledAt | DateTime? | |

### InventoryTransferItem
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| transferId | UUID | FK |
| productId | UUID | FK |
| quantity | Int | |
| **Unique** | | transferId + productId |

## Business Logic

### Warehouse Operations
- **Create**: Validates unique code per org; if `isDefault`, unsets other defaults
- **Update**: Partial update; re-checks code uniqueness
- **Archive**: Sets status to INACTIVE
- **Restore**: Sets status to ACTIVE
- **Delete**: Soft delete with audit log
- **List**: Paginated, searchable by name/code, filterable by status

### Stock Operations
- **Get Stock**: Returns zero-filled default if no record exists
- **Reserve**: Decrements availableQty, increments reservedQty; requires sufficient stock
- **Release**: Increments availableQty, decrements reservedQty
- **Increase**: Increments availableQty (for purchase receipts)
- **Decrease**: Decrements availableQty (for sales fulfillment)
- **Adjust**: Adds/subtracts arbitrary quantity (for corrections)
- **Transfer**: Atomic decrement from source + increment to destination

### Stock Ledger
- Every stock movement creates a StockLedger entry
- Ledger is append-only (no updates, no deletes)
- Tracks previousQty and newQty for full audit trail

### Inventory Transfers
| Status | Transition |
|---|---|
| DRAFT | → IN_TRANSIT (approve) |
| IN_TRANSIT | → COMPLETED (complete) |
| DRAFT / IN_TRANSIT | → CANCELLED (cancel) |
| COMPLETED | Terminal |

### Reservation Flow (Sales Order integration)
1. Sales Order confirmed → Reserve stock
2. Invoice paid → Release reservation (future)
3. Order cancelled → Release reservation

### Dashboard
- Current Inventory (total availableQty)
- Reserved Inventory (total reservedQty)
- Low Stock Count (availableQty > 0 AND availableQty <= reorderLevel)
- Out Of Stock Count (availableQty = 0)
- Reserved Count (reservedQty > 0)
- Top Moving Products (last 30 days sales by ledger quantity)
- Recent Transfers (last 5)

## Security

- **Organization Isolation**: All queries scoped to `organizationId`
- **RBAC**: Permission-based access via `@Permissions()` decorator:
  - `warehouse:create/read/update/delete`
  - `stock:read/reserve/release/adjust`
  - `transfer:create/read/approve/complete/cancel`
  - `inventory:dashboard/search`
- **Audit Logging**: Every mutation records audit log
- **Swagger**: All endpoints documented with `@ApiTags`, `@ApiOperation`

## Performance

- Database indexes on `organizationId`, `warehouseId`, `productId`, `status`, `deletedAt`
- Unique composite index on `(warehouseId, productId)` for Stock
- Unique composite index on `(organizationId, code)` for Warehouse
- Paginated list endpoints with configurable page/limit
- Batched operations where possible (Promise.all)

## Test Coverage

| Module | Tests | Status |
|---|---|---|
| Warehouse | 7 (create, findAll, findOne, update, archive, restore, delete, org isolation) | ✅ |
| Stock | 11 (getStock, reserve, reserve insufficient, release, release insufficient, adjust increase, adjust decrease, adjust negative, increase, decrease, decrease insufficient, ledger creation, org isolation) | ✅ |
| Transfer | 10 (create, create same warehouse, create invalid warehouse, findOne, findOne wrong org, approve, approve non-draft, complete, cancel, cancel completed, org isolation) | ✅ |
| **Total** | **36 tests** | ✅ |

## Verification

- `npm run build` — ✅ Passes
- `npm run lint` — ✅ Clean
- `npm test` — ✅ 669/669 pass (including 36 inventory tests)
- `npx prisma validate` — ✅ Valid

## Integration Points

| Module | Integration |
|---|---|
| Products | Stock references Product by ID |
| Sales Orders | Reserve/release stock on order lifecycle |
| Purchase Orders | Future — increase stock on receipt |
| Accounting | Future — COGS tracking via StockLedger |

## Architecture Decisions

1. **Zero-default stock**: `getStock` returns `{ availableQty: 0 }` instead of 404 when no record exists. `getOrCreateStock` creates a record lazily on first mutation.
2. **Column comparison for low stock**: Prisma doesn't support comparing two columns in WHERE. The low stock filter fetches IDs first, then queries with `id IN (...)`.
3. **Integer quantities**: All quantities are integers (not floats) for precision. No decimal support in v1.
4. **Soft delete for warehouses**: Warehouses are soft-deleted to preserve historical ledger entries.
5. **Ledger append-only**: StockLedger is never updated or deleted, ensuring a complete audit trail.
