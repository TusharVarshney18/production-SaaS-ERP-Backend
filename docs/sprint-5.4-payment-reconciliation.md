# Sprint 5.4 — Payment Reconciliation

## Overview

Complete Payment Reconciliation module that records payments against Sales Invoices, automatically updates invoice payment status (amountPaid, balanceDue, paymentStatus, status), and supports manual/gateway payments, partial payments, allocation tracking, and refunds.

## Files Created/Modified

### Prisma Schema (`prisma/schema.prisma`)

- **Added enum**: `PaymentGatewayType` (RAZORPAY, STRIPE, MANUAL)
- **Added enum**: `SalesPaymentStatus` (PENDING, AUTHORIZED, CAPTURED, FAILED, REFUNDED)
- **Added model**: `SalesPayment` — payment record with gateway, transaction tracking, status, and invoice linkage
- **Added model**: `PaymentAllocation` — explicit allocation tracking linking payments to invoices with amounts
- **Updated models**: `Organization`, `SalesInvoice` — added back-references

### New Module: `src/payments/`

| File | Description |
|---|---|
| `payments.module.ts` | NestJS module wiring |
| `payments.controller.ts` | 7 REST endpoints |
| `payments.service.ts` | Full business logic — manual payments, gateway capture, allocation, refund, invoice auto-update, timeline, audit |
| `dto/create-manual-payment.dto.ts` | Manual payment creation DTO |
| `dto/capture-gateway-payment.dto.ts` | Gateway payment capture DTO |
| `dto/refund-payment.dto.ts` | Payment refund DTO |
| `dto/payment-query.dto.ts` | Search, filter, pagination DTO |
| `__tests__/payments.service.spec.ts` | 16 tests — all operations, validations, isolation |
| `__tests__/payments.controller.spec.ts` | 7 tests — delegation |

### Modified Files

| File | Change |
|---|---|
| `src/app.module.ts` | Added `PaymentsModule` import |

## Reused Components

- **Razorpay & Stripe Providers** — Gateway payments re-use existing `PaymentGateway` interface and provider implementations from the billing module
- **`PricingService`** — No direct reuse (pricing is already finalized on the invoice), but consistent with the architecture
- **`SalesInvoice` model** — The reconciliation flow auto-updates `amountPaid`, `balanceDue`, `paymentStatus`, and `status` on invoices
- **Authentication** — `JwtAuthGuard`
- **RBAC** — `PermissionGuard` + `@Permissions()` decorator
- **Audit Logs** — `AuditLogService` for all mutations

## API Endpoints

All under `/sales/organizations/:orgId`

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/payments/manual` | `payment:create` | Record a manual payment (cash, cheque, bank transfer) |
| POST | `/payments/gateway` | `payment:create` | Capture a gateway payment (Razorpay/Stripe) |
| POST | `/payments/:id/allocate` | `payment:update` | Allocate payment amount to an invoice |
| POST | `/payments/refund` | `payment:refund` | Refund a captured payment |
| GET | `/payments` | `payment:read` | List payments with search/filter/pagination |
| GET | `/payments/:id` | `payment:read` | Get payment details with allocations |
| GET | `/invoices/:invoiceId/payments` | `payment:read` | Get all payments for an invoice |

### Search & Filters

- Search by transaction ID
- Filter by: invoice, gateway (RAZORPAY/STRIPE/MANUAL), status, date range

## Auto-Invoice Updates

When a payment is created, captured, or refunded, the invoice is automatically reconciled:

| Invoice Field | Update Logic |
|---|---|
| `amountPaid` | Sum of all non-refunded CAPTURED payment amounts |
| `balanceDue` | `grandTotal - amountPaid` (minimum 0) |
| `paymentStatus` | UNPAID → PARTIALLY_PAID → PAID (automatic) |
| `status` | SENT → PARTIALLY_PAID → PAID (automatic) |

## Payment Allocation Model

- `PaymentAllocation` tracks exactly how much of a payment is applied to which invoice
- Supports multiple payments against one invoice
- Supports partial payments (underpayment)
- Overpayment detection: blocked with clear error message
- Refunds reduce the allocation amount

## Security

- **Organization isolation**: All queries scoped by `organizationId`
- **RBAC**: Permissions (`payment:create`, `:read`, `:update`, `:refund`)
- **Audit logging**: Every mutation recorded via `AuditLogService`
- **DTO validation**: `class-validator` on all DTOs
- **Swagger**: Full Swagger decoration

## Verification Results

```
✓ npm run build          — clean
✓ npm run lint           — clean (0 errors)
✓ npm test               — 633 passed, 47 suites
✓ npx prisma validate    — valid
```

## Architecture Review

### Code Duplication Review

- **Minimal duplication**. No payment logic is duplicated from the billing module — the new `SalesPayment` model is purpose-built for sales invoice reconciliation, while the billing `Payment` model handles subscription billing.
- The `updateInvoicePaymentStatus` reconciliation logic is new and doesn't exist elsewhere.
- Timeline + audit log helpers follow the established pattern from earlier sprints.

### Shared Service Opportunities

1. **PaymentGateway providers** — Already reusable via the `PaymentProviderFactory`. The new module could use `PaymentGatewayService` for gateway-side operations (capture, refund via provider API) in a future iteration.
2. **`updateInvoicePaymentStatus`** — This reconciliation logic could be extracted into the `InvoicesService` as a shared method for any module that needs to update invoice payment state.

### Technical Debt Introduced

1. **No gateway API integration** — The `captureGateway` endpoint creates a local payment record but doesn't call the actual Razorpay/Stripe API to capture. This is appropriate for the current scope (record-keeping), but a future iteration should integrate with the `PaymentGatewayService` for true gateway capture.
2. **Overpayment handling** — Currently blocked with an error. A full implementation should create a credit note or customer wallet credit.
3. **Refund allocation** — Refunds reduce allocations against a single invoice. For cross-invoice refunds, a more sophisticated allocation strategy is needed.

### Suggested Refactoring Before Sprint 6.0

1. **Wire `PaymentGatewayService` into `captureGateway`** — Use the existing `PaymentGatewayService.createCheckout` / `verifyPayment` / `refund` methods to actually interact with Razorpay/Stripe providers instead of just recording locally.
2. **Extract `InvoicePaymentReconciler`** — Move `updateInvoicePaymentStatus` into a shared service that both `InvoicesService` and `PaymentsService` can use.
3. **Unify billing and sales payment models** — Consider whether the billing `Payment` and `SalesPayment` models can share a common base after Sprint 6.0.
4. **Add credit note / overpayment handling** — When overpayment is detected, automatically create a credit note or customer credit rather than rejecting.
