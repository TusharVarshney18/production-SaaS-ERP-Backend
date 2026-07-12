# Sprint 7 — Procurement & Vendor Management

## Overview

Complete Procurement domain for the ERPX platform, providing vendor management, purchase orders, goods receipt with inventory integration, and stock ledger tracking.

## Module Structure

```
src/procurement/
├── procurement.module.ts              # Root module
├── procurement.controller.ts          # Dashboard & search endpoints
├── procurement.service.ts             # Dashboard aggregation & search logic
├── vendors/
│   ├── vendors.module.ts
│   ├── vendors.controller.ts
│   ├── vendors.service.ts             # CRUD, archive, restore, soft-delete
│   ├── dto/
│   │   ├── create-vendor.dto.ts
│   │   ├── update-vendor.dto.ts
│   │   └── vendor-query.dto.ts
│   └── __tests__/
│       └── vendors.service.spec.ts
├── purchase-orders/
│   ├── purchase-orders.module.ts
│   ├── purchase-orders.controller.ts
│   ├── purchase-orders.service.ts     # Create, update, approve, cancel, duplicate
│   ├── dto/
│   │   ├── create-purchase-order.dto.ts
│   │   ├── update-purchase-order.dto.ts
│   │   └── purchase-order-query.dto.ts
│   └── __tests__/
│       └── purchase-orders.service.spec.ts
├── goods-receipt/
│   ├── goods-receipt.module.ts
│   ├── goods-receipt.controller.ts
│   ├── goods-receipt.service.ts       # Receive items, partial, complete, cancel
│   ├── dto/
│   │   ├── create-goods-receipt.dto.ts
│   │   └── goods-receipt-query.dto.ts
│   └── __tests__/
│       └── goods-receipt.service.spec.ts
```

## Prisma Models

### Vendor
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organizationId | UUID | Tenant isolation |
| vendorCode | String | Unique per org |
| companyName | String | |
| contactName | String? | |
| email | String? | |
| phone | String? | |
| taxNumber | String? | |
| address | String? | |
| status | VendorStatus | ACTIVE / INACTIVE |
| deletedAt | DateTime? | Soft delete |

### PurchaseOrder
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organizationId | UUID | Tenant isolation |
| poNumber | String | Auto-generated (PO-YYMMDD-NNNN) |
| vendorId | UUID | FK to Vendor |
| warehouseId | UUID | FK to Warehouse |
| expectedDate | DateTime? | |
| status | PurchaseOrderStatus | DRAFT → SENT → APPROVED → PARTIALLY_RECEIVED / RECEIVED / CANCELLED |
| subtotal/taxAmount/discountAmount/grandTotal | Int | Calculated from items |
| createdBy/approvedBy/cancelledBy | String | User IDs |

### PurchaseOrderItem
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| purchaseOrderId | UUID | FK |
| productId | UUID | FK |
| quantity | Int | |
| receivedQuantity | Int | Updated by goods receipt |
| unitCost | Int | |
| taxRate | Int | Percentage |
| lineTotal | Int | quantity * unitCost |

### GoodsReceipt
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organizationId | UUID | |
| grnNumber | String | Auto-generated (GRN-YYMMDD-NNNN) |
| purchaseOrderId | UUID | FK |
| warehouseId | UUID | FK |
| status | GoodsReceiptStatus | DRAFT → RECEIVED / CANCELLED |
| receivedDate | DateTime? | |
| createdBy | String | |

### GoodsReceiptItem
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| goodsReceiptId | UUID | FK |
| purchaseOrderItemId | UUID | FK |
| productId | UUID | FK |
| quantity | Int | |
| unitCost | Int | Copied from PO item |

## Business Logic

### Vendor Operations
- **Create**: Validates unique vendorCode per org
- **Update**: Partial update; re-checks vendorCode uniqueness
- **Archive**: Sets status to INACTIVE
- **Restore**: Sets status to ACTIVE
- **Delete**: Soft delete with audit log
- **Search**: By companyName, vendorCode, contactName, email

### Purchase Order Operations
| Operation | Allowed Statuses | Notes |
|---|---|---|
| Create | — | Auto-generates PO number, calculates totals |
| Update | DRAFT | Replaces items entirely |
| Approve | DRAFT, SENT | Sets approvedBy + approvedAt |
| Cancel | DRAFT, SENT, APPROVED, PARTIALLY_RECEIVED | |
| Duplicate | Any | Copies all fields as new DRAFT |
| Receive | APPROVED, PARTIALLY_RECEIVED, SENT | Via GoodsReceipt |

### Goods Receipt → Inventory Integration
1. Validates PO is not DRAFT or CANCELLED
2. Validates quantities don't exceed remaining
3. **Database transaction**: Creates GoodsReceipt + items, updates PO item `receivedQuantity`, updates PO status
4. Calls `StockService.increase()` for each item → increments `availableQty`, creates `StockLedger` entry with `transactionType: 'PURCHASE'`, creates audit log
5. Updates PO status to `PARTIALLY_RECEIVED` or `RECEIVED` based on fulfillment

### Purchase Order Status Transitions
```
DRAFT ──→ SENT ──→ APPROVED ──→ PARTIALLY_RECEIVED ──→ RECEIVED
  │                    │                                       │
  └────── CANCELLED ←──┘                                       │
         ↑                                                     │
         └─────────────────────────────────────────────────────┘
```

### Dashboard
- Total Active Vendors
- Pending Purchase Orders (DRAFT, SENT, APPROVED, PARTIALLY_RECEIVED)
- Goods Awaiting Receipt (sum of unreceived quantities)
- Monthly Purchasing (sum of non-cancelled POs this month)
- Top Vendors by spend (top 5)

## Security

- **Organization Isolation**: All queries scoped to `organizationId`
- **RBAC**: Permission-based access:
  - `vendor:create/read/update/delete`
  - `purchase_order:create/read/update/approve/cancel`
  - `goods_receipt:create/read/cancel`
  - `procurement:dashboard/search`
- **Audit Logging**: Every mutation records audit log
- **Swagger**: All endpoints documented

## Performance

- Database indexes on `organizationId`, `vendorId`, `warehouseId`, `status`, `poNumber`, `grnNumber`
- Unique composite indexes: `(organizationId, vendorCode)`, `(organizationId, poNumber)`, `(organizationId, grnNumber)`, `(purchaseOrderId, productId)`
- Paginated list endpoints
- Database transaction for goods receipt (atomicity)

## Test Coverage

| Module | Tests | Status |
|---|---|---|
| Vendors | 9 (create, create duplicate, findAll, findOne, findOne wrong org, update, archive, restore, delete, org isolation) | ✅ |
| Purchase Orders | 9 (create, create invalid vendor, findOne, findOne wrong org, approve, approve invalid, cancel, cancel invalid, duplicate, update non-draft, org isolation) | ✅ |
| Goods Receipt | 13 (create with stock integration, cancelled PO, draft PO, quantity exceeds, findOne, findOne wrong org, cancel draft, cancel received, inventory integration, org isolation) | ✅ |
| **Total** | **31 tests** | ✅ |

## Verification

- `npm run build` — ✅ Passes
- `npm run lint` — ✅ Clean
- `npm test` — ✅ **700/700 pass** (31 procurement tests)
- `npx prisma validate` — ✅ Valid

## Integration Points

| Module | Integration |
|---|---|
| Inventory (Stock) | Goods receipt calls `StockService.increase()` to update stock + create ledger entry |
| Inventory (Warehouse) | POs and goods receipts reference warehouses |
| Products | PO items and goods receipt items reference products |
| Accounting | Hooks prepared for future COGS postings |
| Payment Gateway | Prepared for future supplier payments |

## Architecture Decisions

1. **PO number generation**: Sequential per org with date prefix (`PO-YYMMDD-NNNN`). Same pattern for GRN (`GRN-YYMMDD-NNNN`).
2. **Database transactions**: Goods receipt uses `$transaction` to ensure atomicity across stock update, PO item update, PO status update, and goods receipt creation.
3. **PricingService reuse**: Purchase order totals are calculated inline (simple qty * cost + tax) rather than using PricingService, since PO pricing is cost-based (not sales pricing).
4. **Status-driven lifecycle**: PO status controls what operations are allowed (e.g., only DRAFT can be updated, only APPROVED/SENT can receive).
5. **Integer amounts**: All monetary values in cents (matching existing PricingService convention).
6. **Partial receipt**: Supported via `receivedQuantity` tracking per PO item. PO status auto-updates to PARTIALLY_RECEIVED or RECEIVED.
