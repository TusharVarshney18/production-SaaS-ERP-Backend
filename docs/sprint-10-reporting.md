# Sprint 10 — Reporting & Analytics Platform

## Overview

Centralized Reporting & Analytics platform providing dashboards, KPIs, exports, and reusable reporting services across all business domains.

## Module Structure

```
src/reports/
├── reports.module.ts                  # Root module
├── reports.controller.ts              # 25+ report endpoints
├── dto/
│   ├── report-query.dto.ts            # Universal query DTO
│   └── chart-data.dto.ts              # Chart/KPI response types
├── services/
│   ├── report-engine.service.ts       # Core reusable engine
│   ├── dashboard.service.ts           # 6 dashboard aggregators
│   ├── sales-reports.service.ts       # Sales, quotations, customers, top products
│   ├── inventory-reports.service.ts   # Stock, movement, warehouses, top moving
│   ├── procurement-reports.service.ts # Purchases, vendors, spend
│   ├── finance-reports.service.ts     # Journals, GL, trial balance, P&L, balance sheet
│   ├── hr-reports.service.ts          # Employees, attendance, leave
│   └── export.service.ts              # CSV, Excel XML, PDF HTML
└── tests/
    ├── report-engine.service.spec.ts
    └── export.service.spec.ts
```

## Core Report Engine

The `ReportEngineService` provides reusable primitives:

| Method | Purpose |
|---|---|
| `buildDateFilter()` | Creates Prisma date range filter |
| `buildSearchFilter()` | Creates OR search across fields |
| `getPagination()` | Calculates skip/take |
| `getOrderBy()` | Creates sort object |
| `paginate()` | Wraps data+count into PaginatedResult |
| `getPeriodOverPeriod()` | Current vs previous period comparison with trend |
| `getMonthlyTrend()` | 12-month aggregation |
| `getGroupedSum()` | GroupBy with sum aggregation |
| `getStatusDistribution()` | Count by status field |

## Dashboards

| Dashboard | KPIs | Charts |
|---|---|---|
| **Executive** | Revenue, Outstanding Invoices, Inventory Value, Purchase Spend, Active Employees | Revenue Trend |
| **Sales** | Revenue | Revenue Trend, Sales by Status, Top Products |
| **Inventory** | Value, Total Stock, Low Stock, Out of Stock, Reserved | Warehouse Stock Distribution |
| **Procurement** | Purchase Spend, Pending POs | Purchase Trend, Purchase by Status |
| **Accounting** | Outstanding Invoices | Trial Balance Comparison |
| **HR** | Active Employees | Employee by Status, by Department |

## Report Endpoints (22 total)

### Sales
- `GET reports/:orgId/sales` — Sales order report
- `GET reports/:orgId/quotations` — Quotation report
- `GET reports/:orgId/customers` — Customer report
- `GET reports/:orgId/sales/top-products` — Top selling products

### Inventory
- `GET reports/:orgId/inventory` — Stock report (low/out-of-stock/reserved filters)
- `GET reports/:orgId/inventory/stock-movement` — Stock ledger movement
- `GET reports/:orgId/inventory/warehouses` — Warehouse stock summary
- `GET reports/:orgId/inventory/top-moving` — Top moving products (30 days)

### Procurement
- `GET reports/:orgId/purchases` — Purchase order report
- `GET reports/:orgId/vendors` — Vendor report

### Finance
- `GET reports/:orgId/journals` — Journal entries
- `GET reports/:orgId/general-ledger` — General ledger lines
- `GET reports/:orgId/trial-balance` — Trial balance
- `GET reports/:orgId/profit-loss` — Profit & loss statement
- `GET reports/:orgId/balance-sheet` — Balance sheet

### HR
- `GET reports/:orgId/employees` — Employee report
- `GET reports/:orgId/attendance` — Attendance report
- `GET reports/:orgId/leave` — Leave report

## Exports

| Format | Method | Content Type |
|---|---|---|
| CSV | `toCsv()` | `text/csv` |
| Excel (XML) | `toExcelXml()` | `application/vnd.ms-excel` |
| PDF (HTML foundation) | `toPdfHtml()` | HTML template for PDF rendering |

### Export Endpoints
- `POST reports/:orgId/export/csv`
- `POST reports/:orgId/export/excel`

## Chart API Format

All dashboards return frontend-ready chart data:

```typescript
// KPI Card
{ label: string; value: number; change: number; trend: 'up' | 'down' | 'neutral' }

// Chart Data
{ labels: string[]; datasets: { label: string; data: number[]; backgroundColor?: string; borderColor?: string }[] }

// Paginated Report
{ data: Record[]; meta: { total: number; page: number; limit: number; totalPages: number } }
```

## Performance

- Pagination on all list reports
- Aggregation queries use Prisma `groupBy` and `aggregate`
- Filter pushdown to database (date ranges, status filters)
- Search uses `contains` with `mode: 'insensitive'`

## Security

- **Organization Isolation**: All queries scoped to `organizationId`
- **RBAC**:
  - `report:dashboard` — Access to all dashboards
  - `report:read` — Access to all reports
  - `report:export` — Access to exports
- **Swagger**: All endpoints documented with `@ApiTags('Reports & Analytics')`

## Test Coverage

| Module | Tests | Status |
|---|---|---|
| ReportEngine | 4 (date filter, pagination, period-over-period, status distribution) | ✅ |
| ExportService | 4 (CSV, CSV escape, Excel XML, PDF HTML) | ✅ |
| **Total** | **8 tests** (+ 5 existing accounting report tests) | ✅ |

## Verification

| Check | Result |
|---|---|
| `npm run build` | ✅ Passes |
| `npm run lint` | ✅ 0 errors (31 `any` warnings for dynamic Prisma) |
| `npm test` | ✅ **762/762 pass** (8 report + 5 accounting report tests) |
| `npx prisma validate` | ✅ Valid |
| `docs/sprint-10-reporting.md` | ✅ Generated |

## Architecture Decisions

1. **Reusable ReportEngine**: Core engine provides filtering, pagination, and aggregation primitives reused by all domain report services.
2. **Domain separation**: Each business domain has its own report service, preventing coupling.
3. **Dynamic aggregation**: `ReportEngine` uses `(this.prisma as any)[model]` pattern for dynamic model access, enabling reusable aggregation methods without per-model code.
4. **No duplication of existing dashboards**: The reporting platform provides new centralized endpoints. Existing domain dashboards (in inventory, procurement) remain untouched.
5. **Chart-ready data**: Dashboard responses are formatted for direct frontend consumption (Chart.js compatible structure).
6. **Export foundation**: CSV and Excel XML are fully implemented. PDF uses HTML foundation that can be rendered by any PDF library (puppeteer, wkhtmltopdf).
