# Sprint 5.0 – Product Catalog

## Overview

Product Catalog module for the ERPX inventory system. Manages products with SKU/barcode tracking, hierarchical categories, and units of measure. Foundation for future inventory, purchasing, and quotation modules.

## Architecture

- **Module**: `ProductsModule` in `src/products/`
- **Controller**: `ProductsController` — routes under `/api/v1/inventory/organizations/:orgId`
- **Service**: `ProductsService` — business logic with org isolation
- **Database**: `Product`, `Category`, `Unit` models in Prisma schema

## Prisma Models

### Category
```prisma
model Category {
  id               String
  organizationId   String
  name             String
  description      String?
  parentCategoryId String?    // self-referencing hierarchy
  displayOrder     Int
  isArchived       Boolean
  children         Category[]
  products         Product[]
}
```

### Unit
```prisma
model Unit {
  id             String
  organizationId String
  name           String       // e.g. "Piece"
  shortName      String       // e.g. "pc"
  precision      Int          // decimal places
  products       Product[]
}
```

### Product
```prisma
model Product {
  id              String
  organizationId  String
  sku             String       // unique within org
  barcode         String?
  name            String
  description     String?
  categoryId      String?
  unitId          String?
  sellingPrice    Int          // in cents
  purchasePrice   Int          // in cents
  taxRate         Int          // percentage
  currency        String
  status          ProductStatus // ACTIVE | INACTIVE
  isService       Boolean
  trackInventory  Boolean
  deletedAt       DateTime?
}
```

## APIs

### Products

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/products` | `product:create` | Create product |
| GET | `/products` | `product:read` | List products |
| GET | `/products/:id` | `product:read` | Get product details |
| PATCH | `/products/:id` | `product:update` | Update product |
| POST | `/products/:id/archive` | `product:update` | Set inactive |
| POST | `/products/:id/restore` | `product:update` | Set active |
| DELETE | `/products/:id` | `product:delete` | Soft delete |

### Categories

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/categories` | `category:create` | Create category |
| GET | `/categories` | `category:read` | List categories |
| GET | `/categories/:id` | `category:read` | Get category with products |
| PATCH | `/categories/:id` | `category:update` | Update category |
| DELETE | `/categories/:id` | `category:delete` | Hard delete |

### Units

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/units` | `unit:create` | Create unit |
| GET | `/units` | `unit:read` | List units |
| GET | `/units/:id` | `unit:read` | Get unit details |
| PATCH | `/units/:id` | `unit:update` | Update unit |
| DELETE | `/units/:id` | `unit:delete` | Hard delete |

## Search

Searches across: `name`, `sku`, `barcode`

## Filters

- `search` — name/SKU/barcode search
- `categoryId` — filter by category
- `status` — ACTIVE / INACTIVE
- `isService` — service flag
- `trackInventory` — inventory tracking flag
- `page`, `limit`, `sortBy`, `sortOrder` — pagination and sorting

## Security

- **Organization isolation**: All queries scoped by `organizationId`
- **RBAC**: Permission guards with `product:*`, `category:*`, `unit:*` permissions
- **Audit logging**: All mutations logged via `AuditLogService`
- **DTO validation**: All inputs validated with `class-validator`
- **Swagger**: Full API documentation via `@nestjs/swagger` decorators

## Permissions (seed.ts)

```typescript
// Inventory group
{ resource: 'product', actions: [create, read, update, delete, *] },
{ resource: 'category', actions: [create, read, update, delete, *] },
{ resource: 'unit', actions: [create, read, update, delete, *] },
```

## Files

| File | Description |
|------|-------------|
| `prisma/schema.prisma` | Product, Category, Unit models |
| `prisma/seed.ts` | Inventory permissions |
| `src/products/products.module.ts` | Module definition |
| `src/products/products.controller.ts` | REST controller (18 endpoints) |
| `src/products/products.service.ts` | Business logic |
| `src/products/dto/` | 7 DTOs |
| `src/products/__tests__/` | Service + controller tests |
| `src/app.module.ts` | Module registration |

## Tests

- **Service tests**: 17 tests — categories CRUD, units CRUD, products CRUD, archive/restore, delete, org isolation, search filtering
- **Controller tests**: 11 tests — all endpoint delegations verified

## Extensibility

This module is designed as the foundation for:
- **Inventory tracking** (`trackInventory` flag on Product, stock levels)
- **Purchasing** (purchase orders referencing products)
- **Quotations** (line items with product references)
- **Sales invoicing** (invoice line items)
