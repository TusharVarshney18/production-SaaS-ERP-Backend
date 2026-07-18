# Sprint 12.3 — Enterprise AI Agent Framework

## Objective

Implement the Enterprise AI Agent Framework for ERPX. Provides agent orchestration — routing user requests to the best agent, planning tool executions, executing through the existing AI Runtime pipeline, and returning structured responses. No agents access Prisma directly; all execution flows through registered AI Tools via the Tool Execution Pipeline.

## Design Principles

- **Zero duplication**: Reuses Sprint 12.1 (IProvider, ProviderFactory, AIGatewayService, config, exceptions) and Sprint 12.2 (PromptRegistry, ToolRegistry, CapabilityRegistry, AISandbox, AIPermissionService, ExecutionPipeline, MetadataService, Decorators)
- **No Prisma in agents**: Agents may ONLY use registered AI Tools; never access PrismaService directly
- **Always through the runtime**: Agents always execute through the Execution Pipeline with Sandbox validation
- **Existing patterns**: Map-based registration (matching PaymentProviderFactory, ActionRegistryService, ToolRegistryService, CapabilityRegistryService), NestJS DI, `@Injectable()` services

## Module Structure

```
src/ai/agents/
├── interfaces/
│   ├── index.ts
│   └── agent.interface.ts                 # IAgent, AgentMetadata, AgentCapability, AgentExecutionPlan, AgentRequest, AgentResponse
├── dto/
│   ├── index.ts
│   ├── agent-request.dto.ts
│   ├── agent-response.dto.ts
│   └── agent-execution-plan.dto.ts
├── agents/
│   ├── index.ts
│   ├── base.agent.ts                      # Abstract BaseAgent (validate, execute, createStep)
│   ├── ceo.agent.ts                       # CEO Agent — executive overview, cross-domain
│   ├── finance.agent.ts                   # Finance Agent — revenue, invoices, payments, reports
│   ├── sales.agent.ts                     # Sales Agent — quotations, orders, customers
│   ├── inventory.agent.ts                 # Inventory Agent — stock, warehouses, transfers, procurement
│   ├── hr.agent.ts                        # HR Agent — employees, attendance, leave, departments
│   ├── reporting.agent.ts                 # Reporting Agent — cross-domain reports, dashboards, exports
│   └── developer.agent.ts                 # Developer Agent — system health, API, audit logs, config
├── registry/
│   ├── index.ts
│   └── agent-registry.service.ts          # Map-based registration, discovery, best-match routing
├── factory/
│   ├── index.ts
│   └── agent-factory.service.ts           # Dynamic agent resolution with DI support
├── router/
│   ├── index.ts
│   └── agent-router.service.ts            # Request → best agent + capability → execution plan
├── planner/
│   ├── index.ts
│   └── agent-planner.service.ts           # Plan creation, validation, complexity estimation
├── executor/
│   ├── index.ts
│   └── agent-executor.service.ts          # Full pipeline orchestration: route → plan → execute → respond
├── context/
│   ├── index.ts
│   └── context-builder.service.ts         # Execution context with org, user, tools, capabilities, providers
└── tests/
    ├── agent-registry.service.spec.ts     # 14 tests
    ├── agent-factory.service.spec.ts      # 8 tests
    ├── agent-router.service.spec.ts       # 6 tests
    ├── agent-planner.service.spec.ts      # 8 tests
    ├── agent-executor.service.spec.ts     # 4 tests
    ├── context-builder.service.spec.ts    # 8 tests
    └── base-agent.spec.ts                 # 10 tests
```

## Files Created (26 new files)

### Interfaces & Types

| File | Purpose |
|------|---------|
| `agents/interfaces/agent.interface.ts` | `IAgent` (execute, plan, validate, canHandle), `AgentMetadata`, `AgentCapability`, `AgentExecutionStep`, `AgentExecutionPlan`, `AgentRequest`, `AgentStepResult`, `AgentResponse` |
| `agents/dto/agent-request.dto.ts` | `AgentRequestDto` and `AgentRequestWithContext` |
| `agents/dto/agent-response.dto.ts` | `AgentResponseDto` and `AgentStepResultDto` |
| `agents/dto/agent-execution-plan.dto.ts` | `AgentExecutionPlanDto` and `AgentExecutionStepDto` |

### Infrastructure Services

| File | Purpose |
|------|---------|
| `agents/registry/agent-registry.service.ts` | Map-based agent registration; `findByCapability/Tool/Provider`; `findBestMatch()` with confidence × priority scoring; deduplicated capability listing |
| `agents/factory/agent-factory.service.ts` | `resolveAgent()` — prefers explicit `agentName` from metadata, falls back to `findBestMatch()` |
| `agents/router/agent-router.service.ts` | `route()` — resolves agent → validates capability → creates plan → enriches context with CapabilityRegistry data |
| `agents/planner/agent-planner.service.ts` | `createPlan()`, `validatePlan()` (checks planId, tool existence, dependency integrity), `estimateComplexity()` |
| `agents/executor/agent-executor.service.ts` | Full orchestration: route → validate plan → execute steps through pipeline → collect results → return AgentResponse. Handles dependency ordering, step failures |
| `agents/context/context-builder.service.ts` | `buildContext()` — injects availableTools, availableCapabilities, availableProviders, defaultTemperature, streaming into ExecutionContext metadata |

### Initial Domain Agents (7 agents)

| Agent | Capabilities | Tools | Priority | Description |
|-------|-------------|-------|----------|-------------|
| **CEO** | executive-overview (0.95), cross-domain-query (0.85), business-intelligence (0.8) | getSalesTotal, getStockLevel, getActiveEmployees, getFinancialSummary | 10 | Executive oversight, business health, strategic insights |
| **Finance** | revenue-analysis (0.95), invoice-management (0.9), payment-tracking (0.9), financial-reporting (0.85) | getSalesTotal, getFinancialSummary, getInvoiceStatus, getPaymentHistory | 8 | Revenue, invoices, payments, balance sheet, P&L |
| **Sales** | sales-analysis (0.95), quotation-management (0.9), order-management (0.9), customer-insights (0.85) | getSalesTotal, getQuotationStatus, getOrderStatus, getCustomerInfo, getTopProducts | 7 | Quotations, orders, customers, sales performance |
| **Inventory** | stock-query (0.95), warehouse-management (0.9), inventory-transfer (0.85), procurement-insights (0.8) | getStockLevel, getWarehouseStatus, getTransferStatus, getPurchaseOrderStatus | 6 | Stock levels, warehouses, transfers, procurement |
| **HR** | employee-info (0.95), attendance-tracking (0.9), leave-management (0.9), department-insights (0.85) | getActiveEmployees, getAttendanceRecord, getLeaveBalance, getDepartmentInfo | 5 | Employees, attendance, leave, departments |
| **Reporting** | report-generation (0.95), data-export (0.9), dashboard-insights (0.85), cross-domain-reporting (0.8) | getSalesTotal, getStockLevel, getActiveEmployees, getFinancialSummary | 4 | Cross-domain reports, dashboards, exports |
| **Developer** | system-status (0.95), api-insights (0.9), audit-query (0.85), configuration-lookup (0.8) | getSystemHealth, getApiEndpoints, getAuditLogs, getProviderStatus | 3 | System health, API docs, audit logs, config |

### Base Agent

| Method | Purpose |
|--------|---------|
| `validate(request)` | Ensures request has text, organizationId, userId |
| `execute(request)` | Validates → plans → executes each step through pipeline → collects AgentStepResult[] → returns AgentResponse |
| `createStep(toolName, input, desc, deps)` | Creates AgentExecutionStep with unique ID |
| `canHandle(request)` | Abstract — each agent implements keyword-based capability matching |
| `plan(request)` | Abstract — each agent implements domain-specific step generation |

## Business Logic

### Agent Matching

```
User Request (text + context)
    │
    ▼
AgentFactory.resolveAgent()
    ├── If metadata.agentName → direct lookup
    └── AgentRegistry.findBestMatch()
            ├── For each agent: canHandle(request)
            ├── Returns AgentCapability with confidence score
            └── Score = confidence × agent.metadata.priority
```

### Execution Flow

```
User Request
    │
    ▼
AgentRouter.route(request)
    ├── Resolve agent
    ├── Get capability match
    └── Create execution plan
    │
    ▼
AgentPlanner.validatePlan(plan)
    ├── Check planId
    ├── Check each toolName exists in ToolRegistry
    └── Check dependency integrity
    │
    ▼
AgentExecutor.executePlan(plan, context)
    ├── For each step (ordered by dependencies):
    │   ├── Check deps met
    │   ├── ExecutionPipeline.execute(toolName, input, context)
    │   └── Collect result
    └── Return AgentResponse (success, results, summary, duration)
```

## Security

| Concern | Implementation |
|---------|---------------|
| No Prisma in agents | Agents receive tools via DI, call `ExecutionPipeline.execute()` only. Pipeline enforces sandbox + permissions |
| Permission enforcement | Every tool execution goes through `AIPermissionService.enforceToolPermission()` + `enforceOrganizationAccess()` in the pipeline |
| Plan validation | `AgentPlanner.validatePlan()` checks tool existence before execution |
| Request validation | `BaseAgent.validate()` ensures text, orgId, userId present |
| Context enrichment | `ContextBuilderService` injects available tools/capabilities/providers for informed routing |

## Test Coverage

| Module | Tests | Key Coverage |
|--------|-------|-------------|
| AgentRegistryService | 14 | register, get, getAll, findByCapability, findByTool, findByProvider, findBestMatch, search, remove, getAgentNames, getCapabilities |
| AgentFactoryService | 8 | getAgent, resolveAgent by name, resolveAgent by match, resolveAgent unmatchable, getAllAgents, getAgentNames, hasAgent |
| AgentRouterService | 6 | route success, route with capability registry enrich, route no match throws, getAgentForRequest, getCapabilityForRequest |
| AgentPlannerService | 8 | createPlan, override inputs, validate valid, validate missing planId, validate missing toolName, validate unknown tool, validate missing dep, estimateComplexity |
| AgentExecutorService | 4 | end-to-end execution, plan validation error, routing error, tool execution failure |
| ContextBuilderService | 8 | buildBaseContext, include tools, include capabilities, extra metadata, optional fields, tool summary, provider summary, capability summary |
| BaseAgent (ConcreteAgent) | 10 | metadata, canHandle match, canHandle no match, plan, validate missing text, validate missing org, validate missing user, validate valid, createStep, getPromptVariables |
| **Total** | **58** | |

## Verification

| Check | Result |
|-------|--------|
| `npm run build` | ✅ Passes |
| `npm run lint` | ✅ 0 errors (26 pre-existing `any` warnings) |
| `npm test` | ✅ **988/988 pass** (89 suites, +58 new tests) |
| `npx prisma validate` | ✅ Valid |

## Architecture Decisions

1. **Agents are not tools**: Agents implement `IAgent` (not `AITool`). They orchestrate tool calls rather than being callable tools themselves. This avoids circular dependencies and keeps concerns separated.

2. **Keyword-based capability matching**: Each agent's `canHandle()` uses keyword detection on the request text. This is intentionally simple — no embeddings or NLP at this stage. Future iterations can replace with embedding-based semantic matching.

3. **Confidence × Priority scoring**: `AgentRegistry.findBestMatch()` scores agents by `capability.confidence * agent.metadata.priority`. Priority allows ranking (CEO=10, Finance=8, etc.) while confidence reflects match quality.

4. **Plan-as-data pattern**: `AgentExecutionPlan` is a plain data object (not a class) with ordered steps. This keeps it serializable, debuggable, and testable without NestJS DI.

5. **No Prisma in agents**: Enforced by design — agents only receive `PromptRegistryService`, `ToolRegistryService`, and `ExecutionPipelineService`. No PrismaService is injected.

6. **Pipeline reuse**: The entire Sprint 12.2 `ExecutionPipelineService` is used unchanged — sandbox validation, permission checks, timeout, audit logging all apply to agent-executed tool calls.

7. **Dependency injection for tools**: Agents register tool requirements in `metadata.requiredTools` as strings (not references). Tool instances are resolved through the `ToolRegistry` at execution time, keeping agents provider-independent.

8. **Extensible agent system**: Adding a new agent requires: (1) create a class extending `BaseAgent`, (2) define `metadata` and implement `canHandle()`/`plan()`, (3) register in `AiModule.onModuleInit()`. No other changes needed.

## What's NOT Implemented (Next Sprints)

- Conversation Memory / Session management
- Long-term Memory / Vector store
- RAG (Retrieval-Augmented Generation)
- Embedding-based semantic matching
- MCP (Model Context Protocol)
- Task Queue / async job scheduling
- Semantic Cache
- Observability / tracing / metrics
- Frontend APIs (AI Workspace)
- Plugin system for third-party agents
