# Sprint 11 — Workflow Automation Engine

## Overview

Reusable workflow automation engine for ERPX. Enables event-driven automation across all business modules. Every ERP module publishes business events; the workflow engine matches events to rules and executes configured actions.

## Module Structure

```
src/workflows/
├── workflows.module.ts                  # Root module (registers action handlers)
├── workflows.controller.ts              # CRUD + event emission endpoints
├── events/
│   ├── business-events.ts               # Event type definitions (17 standard events)
│   └── event-bus.service.ts             # Event publishing service
├── engine/
│   └── workflow-engine.service.ts       # Core engine: match → evaluate → execute
├── actions/
│   ├── action-handler.interface.ts      # ActionHandler contract
│   ├── action-registry.service.ts       # Handler registry (strategy pattern)
│   ├── email-action.service.ts          # Email action
│   ├── webhook-action.service.ts        # Webhook action
│   ├── notification-action.service.ts   # In-app notification action
│   ├── audit-action.service.ts          # Audit log action
│   └── ai-hook-action.service.ts        # AI hook (placeholder)
├── services/
│   └── workflow-definitions.service.ts  # CRUD for workflow rules
└── tests/
    ├── workflow-engine.service.spec.ts
    ├── event-bus.service.spec.ts
    └── action-registry.service.spec.ts
```

## Prisma Models

### WorkflowDefinition
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| organizationId | UUID | Tenant isolation |
| name | String | Unique per org |
| event | String | Business event to trigger on |
| conditions | Json? | IF conditions (field, operator, value) |
| isActive | Boolean | Toggle on/off |

### WorkflowAction
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| workflowDefinitionId | UUID | FK |
| type | Enum | EMAIL, WEBHOOK, NOTIFICATION, AUDIT, AI_HOOK, SMS |
| config | Json | Action-specific configuration |
| order | Int | Execution order |

### WorkflowExecutionLog
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| organizationId | UUID | |
| workflowDefinitionId | UUID | FK |
| event | String | |
| eventPayload | Json? | Full event data |
| status | Enum | PENDING, SUCCESS, FAILED |
| result | Json? | Action results |
| errorMessage | String? | |
| triggeredAt / completedAt | DateTime | |

## Standard Business Events

| Event | Source Module | Description |
|---|---|---|
| LeadCreated | CRM | |
| LeadConverted | CRM | |
| QuotationCreated | Sales | |
| QuotationApproved | Sales | |
| SalesOrderCreated | Sales | |
| InvoiceCreated | Sales/Finance | |
| InvoicePaid | Sales/Finance | |
| PaymentCaptured | Payments | |
| VendorCreated | Procurement | |
| PurchaseOrderApproved | Procurement | |
| GoodsReceived | Procurement | |
| StockLow | Inventory | |
| InventoryAdjusted | Inventory | |
| JournalPosted | Accounting | |
| EmployeeCreated | HRMS | |
| LeaveApproved | HRMS | |
| AttendanceCheckedIn | HRMS | |

## Action Handlers

| Action | Type | Config | Implementation |
|---|---|---|---|
| Email | `EMAIL` | `{ to, subject, template }` | Log-based (SMTP integration ready) |
| Webhook | `WEBHOOK` | `{ url, method }` | HTTP call (placeholder) |
| Notification | `NOTIFICATION` | `{ title, body }` | Log-based |
| Audit | `AUDIT` | `{ severity }` | Creates `AuditLog` entry |
| AI Hook | `AI_HOOK` | `{ prompt }` | Placeholder for future AI |
| SMS | `SMS` | Future | Placeholder |

## Rule Engine

### Condition Operators
| Operator | Description |
|---|---|
| `equals` | Exact match |
| `not_equals` | Not equal |
| `contains` | String contains |
| `greater_than` | Numeric greater than |
| `less_than` | Numeric less than |
| `exists` | Field is present |

### Condition Format
```json
{ "field": "data.amount", "operator": "greater_than", "value": 1000 }
```

### Workflow Status Lifecycle
```
Event emitted → Workflows found → Conditions evaluated
                                    ↓
                              Actions executed
                                    ↓
                          ExecutionLog created (SUCCESS/FAILED)
```

## Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/workflows/:orgId/events` | — | List available business events |
| POST | `/workflows/:orgId/definitions` | `workflow:create` | Create workflow |
| GET | `/workflows/:orgId/definitions` | `workflow:read` | List workflows |
| GET | `/workflows/:orgId/definitions/:id` | `workflow:read` | Get workflow |
| PATCH | `/workflows/:orgId/definitions/:id` | `workflow:update` | Update workflow |
| POST | `/workflows/:orgId/definitions/:id/toggle` | `workflow:update` | Toggle active |
| DELETE | `/workflows/:orgId/definitions/:id` | `workflow:delete` | Delete workflow |
| GET | `/workflows/:orgId/executions` | `workflow:read` | Execution logs |
| POST | `/workflows/:orgId/emit/:event` | `workflow:emit` | Manual event (testing) |

## Security

- **Organization Isolation**: All queries scoped to `organizationId`
- **RBAC**:
  - `workflow:create/read/update/delete` — Workflow CRUD
  - `workflow:emit` — Manual event emission
- **Audit Logging**: Audit action handler, plus audit log on definition changes
- **Swagger**: All endpoints documented

## Event Bus Usage

Domain modules can emit events by injecting `EventBusService`:

```typescript
await this.eventBus.emit({
  organizationId: orgId,
  event: 'InvoicePaid',
  resourceId: invoice.id,
  data: { amount: invoice.grandTotal },
  occurredAt: new Date(),
});
```

## Test Coverage

| Module | Tests | Status |
|---|---|---|
| WorkflowEngine | 2 (execute matching, no workflows) | ✅ |
| EventBus | 2 (emit to engine, error handling) | ✅ |
| ActionRegistry | 2 (register + execute, missing handler) | ✅ |
| **Total** | **6 tests** | ✅ |

## Verification

| Check | Result |
|---|---|
| `npm run build` | ✅ Passes |
| `npm run lint` | ✅ 0 errors (40 `any` warnings for dynamic types) |
| `npm test` | ✅ **768/768 pass** (6 workflow tests) |
| `npx prisma validate` | ✅ Valid |
| `docs/sprint-11-workflows.md` | ✅ Generated |

## Architecture Decisions

1. **Strategy pattern for actions**: `ActionRegistryService` uses a registry pattern where handlers register themselves, making it easy to add new action types.
2. **Event-driven decoupling**: Domain modules emit events with no knowledge of what workflows exist. The workflow engine handles matching and execution.
3. **Append-only execution logs**: Every workflow execution is recorded for audit and debugging. Failed executions capture error messages.
4. **Condition evaluation**: Simple field-operator-value JSON conditions. Nested fields supported via dot notation (e.g., `data.amount`).
5. **No external dependencies**: Email, webhook, and SMS actions are scaffolding (log-based). Ready for real integration without framework changes.
6. **Prisma Json fields**: Action config and execution results use JSON columns for flexible, schema-less storage.
