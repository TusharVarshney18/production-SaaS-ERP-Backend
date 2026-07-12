# Sprint 8 — Accounting Engine

## Overview

Production-grade Accounting module serving as the financial core of ERPX. Provides double-entry bookkeeping with chart of accounts, journal entries, general ledger, trial balance, and financial reports.

## Module Structure

```
src/accounting/
├── accounting.module.ts                  # Root module
├── hooks/
│   └── accounting-hooks.interface.ts     # Future integration interfaces
├── chart-of-accounts/
│   ├── chart-of-accounts.module.ts
│   ├── chart-of-accounts.controller.ts
│   ├── chart-of-accounts.service.ts      # CRUD, account balance, deactivation
│   ├── dto/
│   │   ├── create-chart-of-account.dto.ts
│   │   ├── update-chart-of-account.dto.ts
│   │   └── chart-of-account-query.dto.ts
│   └── __tests__/
│       └── chart-of-accounts.service.spec.ts
├── fiscal-years/
│   ├── fiscal-years.module.ts
│   ├── fiscal-years.controller.ts
│   ├── fiscal-years.service.ts           # CRUD, close year
│   ├── dto/
│   │   ├── create-fiscal-year.dto.ts
│   │   └── update-fiscal-year.dto.ts
│   └── __tests__/
│       └── fiscal-years.service.spec.ts
├── journal-entries/
│   ├── journal-entries.module.ts
│   ├── journal-entries.controller.ts
│   ├── journal-entries.service.ts        # Create, post, reverse, trial balance
│   ├── dto/
│   │   ├── create-journal-entry.dto.ts
│   │   └── journal-entry-query.dto.ts
│   └── __tests__/
│       └── journal-entries.service.spec.ts
└── reports/
    ├── reports.module.ts
    ├── reports.controller.ts
    ├── reports.service.ts                # GL, trial balance, balance sheet, P&L
    └── __tests__/
        └── reports.service.spec.ts
```

## Prisma Models

### ChartOfAccount
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organizationId | UUID | Tenant isolation |
| accountCode | String | Unique per org (e.g. 1000, 2000) |
| accountName | String | |
| accountType | AccountType | ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE |
| parentAccountId | UUID? | Self-referencing hierarchy |
| isSystem | Boolean | Protected from deletion |
| isActive | Boolean | |

### FiscalYear
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| organizationId | UUID | |
| name | String | Unique per org |
| startDate / endDate | DateTime | Non-overlapping |
| isClosed | Boolean | Prevents new postings |

### AccountingPeriod
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| fiscalYearId | UUID | FK |
| periodNumber | Int | 1-12 (or custom) |
| startDate / endDate | DateTime | |
| isClosed | Boolean | |

### JournalEntry
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| organizationId | UUID | |
| journalNumber | String | Auto-generated (JE-YYMMDD-NNNN) |
| referenceType | String? | SalesOrder, PurchaseOrder, etc. |
| referenceId | String? | |
| postingDate | DateTime | |
| status | JournalStatus | DRAFT → POSTED → REVERSED |
| postedAt / reversedAt | DateTime? | Timestamps |

### JournalEntryLine
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| journalEntryId | UUID | FK |
| accountId | UUID | FK to ChartOfAccount |
| debit | Int | In cents |
| credit | Int | In cents |
| description | String? | |

## Business Logic

### Chart of Accounts
- **Create**: Validates unique accountCode; validates parent account exists
- **Update**: Prevents circular parent references
- **Delete**: System accounts are protected; accounts with children are blocked; accounts with transactions are deactivated instead
- **Balance**: Calculates running balance based on account type (debit-normal for ASSET/EXPENSE, credit-normal for LIABILITY/EQUITY/REVENUE)

### Journal Entries
| Validation | Rule |
|---|---|
| Balance check | Total debits must equal total credits |
| Zero check | At least one line must be non-zero |
| Dual check | A line cannot have both debit and credit |
| Active check | All accounts must be active |

### Journal Entry Status Lifecycle
```
DRAFT ──→ POSTED ──→ REVERSED
             ↑           │
             └─── Reversal creates opposite entry ──┘
```

- **Post**: Sets status to POSTED, records postedAt timestamp
- **Reverse**: Only POSTED entries. Creates a new POSTED reversal entry with swapped debits/credits, marks original as REVERSED. Uses database transaction.

### Fiscal Years
- **Create**: Optional periods can be created inline
- **Close**: Validates no draft entries exist in date range, closes all periods atomically

### Reports

#### Trial Balance
- Aggregates all posted journal entry lines by account
- Calculates balance based on account type
- Supports as-of-date filter
- Total debits always equals total credits

#### Balance Sheet (Foundation)
- Assets (debit-normal) grouped by type
- Liabilities (credit-normal), Equity (credit-normal)
- Net income from P&L included in liabilities + equity section
- Supports as-of-date filter

#### Profit & Loss (Foundation)
- Revenue accounts (credit-normal)
- Expense accounts (debit-normal)
- Net profit = total revenue - total expenses
- Supports date range filter

## Accounting Hooks (Interfaces Only)

Prepared interfaces for future integration without modifying existing business logic:

| Hook | Trigger | Accounts Affected |
|---|---|---|
| `onSalesInvoicePosted` | Sales invoice posted | AR, Revenue, Tax |
| `onPaymentReceived` | Payment received | Cash, AR |
| `onPurchaseReceipt` | Goods received | Inventory, AP |
| `onInventoryAdjustment` | Stock adjustment | Inventory, Expense |
| `onRefund` | Refund processed | Cash, AR/AP |

## Security

- **Organization Isolation**: All queries scoped to `organizationId`
- **RBAC**: Permission-based access:
  - `chart_of_account:create/read/update/delete`
  - `fiscal_year:create/read/update/close`
  - `journal_entry:create/read/post/reverse`
  - `accounting_report:read`
- **Audit Logging**: Every mutation records audit log
- **Swagger**: All endpoints documented

## Performance

- Database indexes on `organizationId`, `accountCode`, `accountType`, `postingDate`, `status`
- Unique constraints: `(orgId, accountCode)`, `(orgId, journalNumber)`, `(orgId, fyName)`
- Pagination on list endpoints
- Database transactions for reversals

## Test Coverage

| Module | Tests | Status |
|---|---|---|
| Chart of Accounts | 8 (create, duplicate, findAll, findOne, balance asset, balance liability, delete deactivate, delete system, org isolation) | ✅ |
| Fiscal Years | 6 (create, duplicate name, findOne, close, close already closed, close with drafts, org isolation) | ✅ |
| Journal Entries | 9 (create balanced, create unbalanced, create inactive, findOne, post, post already posted, reverse, reverse draft, trial balance, org isolation) | ✅ |
| Reports | 7 (trial balance aggregation, balance sheet structure, P&L calculation, org isolation GL) | ✅ |
| **Total** | **30 tests** | ✅ |

## Verification

- `npm run build` — ✅ Passes
- `npm run lint` — ✅ Clean
- `npm test` — ✅ **730/730 pass** (30 accounting tests)
- `npx prisma validate` — ✅ Valid

## Architecture Decisions

1. **Integer cents**: All monetary values are stored as integers (cents), matching existing PricingService convention.
2. **Double-entry enforced**: Journal entries require debits = credits validation. Each line must be either debit or credit, never both.
3. **No posting to DRAFT**: Only POSTED entries affect financial reports. DRAFT entries can be edited.
4. **Reversal creates new entry**: Rather than deleting or voiding, reversals create a new posted entry with swapped amounts in a transaction.
5. **Account type determines balance**: ASSET/EXPENSE = debit-normal, LIABILITY/EQUITY/REVENUE = credit-normal.
6. **Future hooks ready**: Interfaces defined for Sales, Procurement, and Inventory integration without modifying existing code.
