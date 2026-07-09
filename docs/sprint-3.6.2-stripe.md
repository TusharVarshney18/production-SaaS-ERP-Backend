# Sprint 3.6.2 — Production Stripe Integration

## Summary

Replaced the mock `StripeProvider` with a real SDK-backed implementation using the official `stripe` npm package. All existing architecture (`PaymentGateway` interface, `PaymentProviderFactory`, `PaymentGatewayService`) remains unchanged.

## Files Created

| File | Purpose |
|------|---------|
| `src/config/stripe.config.ts` | NestJS config namespace for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` |
| `src/billing/providers/stripe/stripe.types.ts` | TypeScript interfaces for `StripeInstance`, `StripeCheckoutSession`, `StripePaymentIntent`, `StripeRefund`, `StripeWebhookEvent` |

## Files Modified

| File | Change |
|------|--------|
| `src/billing/providers/stripe/stripe.provider.ts` | Rewrote mock → real SDK-backed `PaymentGateway` implementation |
| `src/billing/__tests__/stripe.provider.spec.ts` | Rewrote with 30 tests covering all paths |
| `src/app.module.ts` | Added `stripeConfig` to `ConfigModule.forRoot({ load: [...] })` |
| `src/config/config.schema.ts` | Added `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` (optional) |
| `.env.example` | Added `STRIPE_SECRET_KEY=`, `STRIPE_WEBHOOK_SECRET=`, `STRIPE_PUBLISHABLE_KEY=` |
| `package.json` | Added `stripe` dependency |

## Implemented Operations

### `createCheckout`
- Creates a Stripe Checkout Session via `stripe.checkout.sessions.create()`
- Uses idempotency key derived from checkout params (sha256 hash)
- Returns `checkoutUrl` (session.url), `sessionId`, and `provider: 'stripe'`

### `verifyPayment`
- If `paymentId` (PI ID) provided → retrieves `paymentIntents.retrieve()` directly
- If only `sessionId` → retrieves `checkout.sessions.retrieve()` to get `payment_intent`, then retrieves PI
- Maps PI status via `STRIPE_PI_STATUS_MAP`: `succeeded→paid`, `processing→pending`, `requires_*→pending`, `canceled→failed`
- Throws `ServiceUnavailableException` on API failure (never returns `verified: true` on failure)

### `refund`
- Creates a refund via `stripe.refunds.create()`
- Uses idempotency key derived from refund params
- Supports partial refunds and metadata
- Throws `ServiceUnavailableException` on API failure

### `handleWebhook`
- Uses `stripe.webhooks.constructEvent()` for signature verification (timing-safe, built into SDK)
- Falls back to unverified parsing if `webhookSecret` is not configured
- Deduplicates webhooks by event ID via in-memory `Set`

## Retry Strategy

- All SDK calls wrapped with `withRetry()`
- Up to 3 attempts with exponential backoff (200ms, 400ms, 800ms)
- Covers checkout creation, session retrieval, payment intent retrieval, and refunds

## Idempotency

- Checkout sessions: deterministic key from `orgId:subId:planId:amount:currency:checkout`
- Refunds: deterministic key from `refund:paymentId:amount:reason`
- Same params → same key → Stripe returns existing resource (safe retry)
- Different params → different key → new resource

## Test Coverage (30 tests)

| Category | Tests |
|----------|-------|
| `createCheckout` | success, idempotency (same key / different key), null URL fallback, unconfigured, retry, retries exhausted |
| `verifyPayment` | by PI ID, by session (retrieve + fetch), session has no PI, no IDs, failed status, processing status, PI fetch failure, session fetch failure, retry |
| `refund` | full refund, partial refund, metadata, same idempotency key, different idempotency key, API failure, retry |
| `handleWebhook` | valid sig, invalid sig, missing sig header, no secret configured, duplicate event, event ID extraction |
| `configuration` | missing credentials, ensureInitialized throws |

## Verification

```
npm run build      ✅
npm run lint       ✅
npm test           ✅ 27 suites, 336 tests
npx prisma validate ✅
```
