# AI Tools Architecture

## Core Principle

AI NEVER accesses Prisma, databases, or business logic directly. All data access and mutations happen through **registered, permission-gated tools**. This is the most important architectural constraint — it ensures security, auditability, and clean separation of concerns.

## Tool Interface

```typescript
// src/ai/tools/tool.interface.ts

interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterSchema>;
    required: string[];
  };
}

interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ParameterSchema;
}

interface ToolResult {
  success: boolean;
  data: unknown;
  error?: string;
  masked?: boolean;        // Was sensitive data masked?
  auditEntry?: string;     // Audit log reference
}

interface ITool {
  readonly name: string;
  readonly description: string;
  readonly definition: ToolDefinition;
  readonly requiredPermissions: string[];
  readonly modules: string[];

  execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult>;
}

interface ToolExecutionContext {
  organizationId: string;
  userId: string;
  agentName: string;
  requestId: string;
  correlationId: string;
}
```

## Tool Registration

Tools register themselves via `ToolRegistryService`:

```typescript
@Injectable()
export class ToolRegistryService {
  private readonly tools = new Map<string, ITool>();

  register(tool: ITool): void {
    this.tools.set(tool.name, tool);
    this.logger.log(`Tool registered: ${tool.name}`);
  }

  getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  getAllowedTools(permissions: string[]): ITool[] {
    return Array.from(this.tools.values()).filter((t) =>
      t.requiredPermissions.every((p) => permissions.includes(p)),
    );
  }
}
```

## Tool Execution Flow

```
LLM calls tool: inventory_getStockLevels({"productId": "prod-123"})
    │
    ▼
ToolExecutorService
    │
    ├──→ 1. Resolve tool from registry
    ├──→ 2. Validate permissions
    │       ├──→ Does user have tool permission?
    │       ├──→ Does agent have tool permission?
    │       └──→ Is user in correct org?
    │
    ├──→ 3. Execute tool
    │       ├──→ Calls business module service
    │       ├──→ NEVER calls Prisma directly
    │       └──→ NEVER bypasses business logic
    │
    ├──→ 4. Mask sensitive data
    │       ├──→ PII detection and masking
    │       ├──→ Financial data masking (per role)
    │       └──→ Employee data masking (per role)
    │
    ├──→ 5. Audit the execution
    ├──→ 6. Track usage
    └──→ 7. Return result to LLM
```

## Tool Catalog

### CRM Tool

| Property | Value |
|---|---|
| Name | `crm` |
| Permissions | `ai:tool:crm:read`, `ai:tool:crm:write` |
| Modules | CRM |

| Operation | Description | Mutates? | Permission |
|---|---|---|---|
| `crm_getLeads` | List/search leads | No | `ai:tool:crm:read` |
| `crm_getLead` | Get lead details | No | `ai:tool:crm:read` |
| `crm_getDeals` | List/search deals | No | `ai:tool:crm:read` |
| `crm_getDeal` | Get deal details | No | `ai:tool:crm:read` |
| `crm_getCompanies` | List/search companies | No | `ai:tool:crm:read` |
| `crm_getContacts` | List/search contacts | No | `ai:tool:crm:read` |
| `crm_createLead` | Create lead | Yes | `ai:tool:crm:write` |
| `crm_updateDealStage` | Update deal stage | Yes | `ai:tool:crm:write` |

### Sales Tool

| Property | Value |
|---|---|
| Name | `sales` |
| Permissions | `ai:tool:sales:read`, `ai:tool:sales:write` |
| Modules | Sales |

| Operation | Description | Mutates? | Permission |
|---|---|---|---|
| `sales_getOrders` | List/search sales orders | No | `ai:tool:sales:read` |
| `sales_getOrder` | Get order details | No | `ai:tool:sales:read` |
| `sales_getQuotations` | List/search quotations | No | `ai:tool:sales:read` |
| `sales_getInvoices` | List/search invoices | No | `ai:tool:sales:read` |
| `sales_getInvoice` | Get invoice details | No | `ai:tool:sales:read` |
| `sales_getRevenue` | Get revenue summary | No | `ai:tool:sales:read` |
| `sales_createOrder` | Create sales order | Yes | `ai:tool:sales:write` |

### Inventory Tool

| Property | Value |
|---|---|
| Name | `inventory` |
| Permissions | `ai:tool:inventory:read`, `ai:tool:inventory:write` |
| Modules | Inventory |

| Operation | Description | Mutates? | Permission |
|---|---|---|---|
| `inventory_getStock` | Current stock for product | No | `ai:tool:inventory:read` |
| `inventory_searchStock` | Search stock by name/SKU | No | `ai:tool:inventory:read` |
| `inventory_getLowStock` | Get low stock items | No | `ai:tool:inventory:read` |
| `inventory_getStockMovement` | Stock ledger history | No | `ai:tool:inventory:read` |
| `inventory_getWarehouses` | List warehouses | No | `ai:tool:inventory:read` |
| `inventory_getInventoryValue` | Total inventory value | No | `ai:tool:inventory:read` |
| `inventory_adjustStock` | Adjust stock level | Yes | `ai:tool:inventory:write` |
| `inventory_transferStock` | Transfer between warehouses | Yes | `ai:tool:inventory:write` |

### Procurement Tool

| Property | Value |
|---|---|
| Name | `procurement` |
| Permissions | `ai:tool:procurement:read`, `ai:tool:procurement:write` |
| Modules | Procurement |

| Operation | Description | Mutates? | Permission |
|---|---|---|---|
| `procurement_getPurchaseOrders` | List POs | No | `ai:tool:procurement:read` |
| `procurement_getPurchaseOrder` | Get PO details | No | `ai:tool:procurement:read` |
| `procurement_getVendors` | List vendors | No | `ai:tool:procurement:read` |
| `procurement_getVendor` | Get vendor details | No | `ai:tool:procurement:read` |
| `procurement_getSpend` | Purchase spend summary | No | `ai:tool:procurement:read` |
| `procurement_createPO` | Create purchase order | Yes | `ai:tool:procurement:write` |

### Accounting Tool

| Property | Value |
|---|---|
| Name | `accounting` |
| Permissions | `ai:tool:accounting:read`, `ai:tool:accounting:write` |
| Modules | Accounting |

| Operation | Description | Mutates? | Permission |
|---|---|---|---|
| `accounting_getTrialBalance` | Trial balance | No | `ai:tool:accounting:read` |
| `accounting_getProfitAndLoss` | P&L statement | No | `ai:tool:accounting:read` |
| `accounting_getBalanceSheet` | Balance sheet | No | `ai:tool:accounting:read` |
| `accounting_getJournals` | List journal entries | No | `ai:tool:accounting:read` |
| `accounting_getAccounts` | Chart of accounts | No | `ai:tool:accounting:read` |
| `accounting_getAccountBalance` | Single account balance | No | `ai:tool:accounting:read` |
| `accounting_getOutstandingInvoices` | Outstanding AR | No | `ai:tool:accounting:read` |

### HRMS Tool

| Property | Value |
|---|---|
| Name | `hrms` |
| Permissions | `ai:tool:hrms:read`, `ai:tool:hrms:write` |
| Modules | HRMS |

| Operation | Description | Mutates? | Permission |
|---|---|---|---|
| `hrms_getEmployees` | List employees | No | `ai:tool:hrms:read` |
| `hrms_getEmployee` | Get employee details | No | `ai:tool:hrms:read` |
| `hrms_getAttendance` | Attendance history | No | `ai:tool:hrms:read` |
| `hrms_getLeaveRequests` | Leave requests | No | `ai:tool:hrms:read` |
| `hrms_getDepartments` | List departments | No | `ai:tool:hrms:read` |
| `hrms_getEmployeeCount` | Employee count | No | `ai:tool:hrms:read` |
| `hrms_getAttendanceRate` | Attendance rate | No | `ai:tool:hrms:read` |

### Reporting Tool

| Property | Value |
|---|---|
| Name | `reporting` |
| Permissions | `ai:tool:reporting:read` |
| Modules | Reports |

| Operation | Description | Mutates? | Permission |
|---|---|---|---|
| `reporting_getDashboard` | Get dashboard data | No | `ai:tool:reporting:read` |
| `reporting_getSalesReport` | Sales report | No | `ai:tool:reporting:read` |
| `reporting_getInventoryReport` | Inventory report | No | `ai:tool:reporting:read` |
| `reporting_getFinanceReport` | Finance report | No | `ai:tool:reporting:read` |
| `reporting_getHRReport` | HR report | No | `ai:tool:reporting:read` |
| `reporting_exportCsv` | Export data to CSV | No | `ai:tool:reporting:read` |

### Workflow Tool

| Property | Value |
|---|---|
| Name | `workflow` |
| Permissions | `ai:tool:workflow:read`, `ai:tool:workflow:write` |
| Modules | Workflows |

| Operation | Description | Mutates? | Permission |
|---|---|---|---|
| `workflow_getDefinitions` | List workflow definitions | No | `ai:tool:workflow:read` |
| `workflow_getExecutions` | Get execution log | No | `ai:tool:workflow:read` |
| `workflow_triggerEvent` | Emit business event | Yes | `ai:tool:workflow:write` |

### Payment Tool

| Property | Value |
|---|---|
| Name | `payment` |
| Permissions | `ai:tool:payment:read`, `ai:tool:payment:write` |
| Modules | Payments |

| Operation | Description | Mutates? | Permission |
|---|---|---|---|
| `payment_getPayments` | List payments | No | `ai:tool:payment:read` |
| `payment_getPayment` | Get payment details | No | `ai:tool:payment:read` |
| `payment_getOutstanding` | Outstanding payments | No | `ai:tool:payment:read` |

## Tool Implementation Pattern

```typescript
// Example: inventory.tool.ts
@Injectable()
export class InventoryTool implements ITool {
  readonly name = 'inventory';
  readonly description = 'Inventory management operations';
  readonly requiredPermissions = ['ai:tool:inventory:read'];
  readonly modules = ['inventory'];

  readonly definition: ToolDefinition = {
    name: 'inventory',
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'The inventory operation to perform',
          enum: ['getStock', 'searchStock', 'getLowStock', 'getStockMovement', 'getWarehouses', 'getInventoryValue', 'adjustStock', 'transferStock'],
        },
        args: {
          type: 'object',
          description: 'Operation-specific arguments',
        },
      },
      required: ['operation'],
    },
  };

  constructor(private readonly inventoryService: InventoryReportsService) {}

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const operation = args.operation as string;
    const operationArgs = (args.args || {}) as Record<string, unknown>;

    try {
      const data = await this.dispatch(operation, operationArgs, context);
      return { success: true, data };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  }

  private async dispatch(
    operation: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const { organizationId } = context;

    switch (operation) {
      case 'getStock':
        return this.inventoryService.getInventoryReport(organizationId, args as any);
      case 'getLowStock':
        return this.inventoryService.getInventoryReport(organizationId, { status: 'low_stock' });
      case 'getStockMovement':
        return this.inventoryService.getStockMovementReport(organizationId, args as any);
      case 'getInventoryValue':
        return this.inventoryService.getInventoryValue(organizationId);
      // ... more operations
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}
```

## Permission Validation

Each tool execution goes through multi-layer permission checks:

```
1. User Authentication → Is user authenticated?
2. Organization Scope → Is user in the required org?
3. RBAC Permission → Does user's role have ai:tool:xxx permission?
4. Agent Permission → Is the agent allowed to use this tool?
5. Data Sensitivity → Should results be masked?
6. Mutation Check → Is the user allowed to mutate data?

All checks MUST pass. If any check fails, the tool returns:
{ success: false, error: "Permission denied: reason" }
```

## Error Handling Strategy

```typescript
enum ToolErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
}

interface ToolError {
  code: ToolErrorCode;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean; // Can the LLM retry with different args?
}
```

Errors are returned to the LLM in a structured format so the LLM can:
1. Understand what went wrong
2. Request user clarification if needed
3. Retry with corrected parameters for recoverable errors
