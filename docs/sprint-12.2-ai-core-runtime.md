# Sprint 12.2 — Enterprise AI Core Runtime

## Objective

Implement the AI Core Runtime for ERPX. This sprint establishes the runtime infrastructure that powers all future AI Agents — prompt management, capability resolution, tool registration and execution, sandboxed security, and a metadata/decorator system. No agents, memory, conversation, RAG, embeddings, or frontend APIs.

## Design Principles

- **No code duplication**: Reuses existing AI foundation (Sprint 12.1) interfaces, providers, factory, config, gateway, health, and exceptions
- **Reuses existing platform modules**: AuthorizationService (RBAC), AuditLogService (audit trail), ConfigService (configuration), PrismaService (not directly — tools call business services only)
- **Reuses existing patterns**: Map-based registry (PaymentProviderFactory, ActionRegistryService), Reflector metadata (Permissions decorator), NestJS DI

## Module Structure

```
src/ai/
├── ai.module.ts                                # Updated — imports new services
├── registry/
│   ├── index.ts
│   ├── prompt-registry.service.ts              # Prompt Registry
│   ├── capability-registry.service.ts          # Capability Registry
│   ├── tool-registry.service.ts                # Tool Registry
│   └── metadata/
│       ├── index.ts
│       └── metadata.service.ts                 # Reflection-based metadata reader
├── tools/
│   ├── index.ts
│   ├── interfaces/
│   │   ├── index.ts
│   │   └── ai-tool.interface.ts               # AITool contract
│   └── execution/
│       ├── index.ts
│       └── execution-pipeline.service.ts       # Orchestrated execution pipeline
├── sandbox/
│   ├── index.ts
│   └── ai-sandbox.service.ts                   # Request validation, audit, timeout, masking
├── authorization/
│   ├── index.ts
│   └── ai-permission.service.ts                # RBAC + org isolation for AI
├── execution/
│   ├── index.ts
│   └── execution-context.ts                    # Execution context interface
├── interfaces/
│   ├── index.ts                                # Updated exports
│   └── runtime.interface.ts                    # Runtime type definitions
├── decorators/
│   ├── index.ts
│   ├── ai-tool.decorator.ts                    # @AITool
│   ├── capability.decorator.ts                 # @Capability
│   ├── permission.decorator.ts                 # @AIPermission
│   ├── metadata.decorator.ts                   # @AIMetadata
│   └── provider-support.decorator.ts           # @ProviderSupport
└── tests/
    ├── prompt-registry.service.spec.ts         # 21 tests
    ├── capability-registry.service.spec.ts     # 21 tests
    ├── tool-registry.service.spec.ts           # 16 tests
    ├── metadata.service.spec.ts                # 8 tests
    ├── ai-permission.service.spec.ts           # 11 tests
    ├── ai-sandbox.service.spec.ts              # 18 tests
    └── execution-pipeline.service.spec.ts      # 6 tests
```

## Files Created

### Interfaces & Types

| File | Purpose |
|------|---------|
| `src/ai/interfaces/runtime.interface.ts` | `ToolParameter`, `ToolMetadata`, `AIToolResult`, `PromptVariable`, `PromptDefinition`, `CapabilityDefinition`, `ProviderPreference`, `SandboxOptions`, `ExecutionPipelineResult` |
| `src/ai/tools/interfaces/ai-tool.interface.ts` | `AITool<TInput, TOutput>` contract — name, description, version, category, parameters, permissions, timeout, requiresConfirmation, providerSupport, metadata, execute(), validate() |
| `src/ai/execution/execution-context.ts` | `ExecutionContext` — organizationId, userId, requestId, correlationId, role, ipAddress, userAgent, metadata |

### Registry Services

| File | Purpose |
|------|---------|
| `src/ai/registry/prompt-registry.service.ts` | Register/get/search prompts by name/version; render with variable interpolation ({{varName}}); validate templates; load from filesystem (JSON or frontmatter); in-memory cache with TTL |
| `src/ai/registry/capability-registry.service.ts` | Register/get/search capabilities; findByTool, findByModel, findByProvider; query provider preferences, temperature, context limit, streaming support |
| `src/ai/registry/tool-registry.service.ts` | Register/get/search tools; findByCategory; getToolDefinitions (for LLM function calling); track categories; DI-compatible registration pattern |
| `src/ai/registry/metadata/metadata.service.ts` | Reflection-based reader for decorator metadata (@AITool, @Capability, @AIPermission, @AIMetadata, @ProviderSupport) using NestJS Reflector |

### Security & Sandbox

| File | Purpose |
|------|---------|
| `src/ai/authorization/ai-permission.service.ts` | Delegates to existing `AuthorizationService.authorize()`; enforces tool-level RBAC; enforces organization isolation |
| `src/ai/sandbox/ai-sandbox.service.ts` | Five-point validation: (1) org isolation, (2) permission check, (3) input size limit, (4) tool.validate(), (5) execution timeout via `Promise.race`. Plus: sensitive data masking (configurable field list), audit logging (success/failure, duration, masked input), graceful audit failure handling |

### Execution Pipeline

| File | Purpose |
|------|---------|
| `src/ai/tools/execution/execution-pipeline.service.ts` | Full pipeline: registry lookup → sandbox validation → permission enforcement → org isolation → timed execution → audit log → structured result. Handles success and error paths, supports batch execution |

### Decorators

| Decorator | Target | Purpose |
|-----------|--------|---------|
| `@AITool(metadata)` | Class | Marks class as an AI tool with name/description/category/version |
| `@Capability(metadata)` | Class/Method | Marks class/method with capability name/description |
| `@AIPermission(...perms)` | Class/Method | Declares required permissions for tool execution |
| `@AIMetadata(key, value)` | Class/Method | Generic key-value metadata annotation |
| `@ProviderSupport(...providers)` | Class/Method | Declares which LLM providers support this tool |

## Business Logic

### Prompt Registry

| Operation | Logic |
|-----------|-------|
| Register | Stores prompt by `name@version` key; warns on overwrite |
| Get | Returns by exact `name@version` or `name@latest` (highest version string) |
| Render | Iterates declared variables, substitutes `{{varName}}` with provided values or defaults; throws if required variable missing without default |
| Validate | Checks name/version/template presence; verifies all template vars are declared; detects duplicate declarations |
| Load from file | Parses JSON or frontmatter (`---` delimited) format; auto-registers |
| Cache | Per-entry TTL (configurable via `ai.promptCacheTtl`), stale entries evicted on access |

### Capability Registry

| Operation | Logic |
|-----------|-------|
| Register | Maps capability name → definition; warns on overwrite |
| FindByTool | Returns capabilities whose `supportedTools` array includes the tool name |
| FindByModel | Returns capabilities whose `models` array includes the model |
| FindByProvider | Returns capabilities whose `providerPreferences` reference the provider |
| Query | Default temperature, context limit, streaming flag per capability |

### Tool Registry

| Operation | Logic |
|-----------|-------|
| Register | Maps tool name → AITool instance; warns on overwrite |
| GetToolDefinitions | Returns `ToolMetadata[]` for all registered tools (LLM function calling format) |
| FindByCategory | Case-insensitive category match |
| Categories | Deduplicates and sorts all registered category names |

### AI Sandbox

| Step | Validation |
|------|------------|
| 1 | Organization isolation — context org must match |
| 2 | Permission check — delegates to AuthorizationService.authorize() |
| 3 | Input size — estimated UTF-8 byte length ≤ maxInputSize (default 1MB) |
| 4 | Tool.validate() — optional custom validation hook |
| 5 | Execution timeout — `Promise.race` with configurable timeout (default 30s) |
| Audit | Logs every execution via AuditLogService with masked sensitive data |
| Masking | Configurable field list (password, secret, token, apiKey, authorization, ssn, creditCard); masks JSON string values and URL query params |

### Execution Pipeline

```
Agent Request
    │
    ▼
ToolRegistry.get(toolName)
    │
    ▼
Sandbox.enforceRequest(input, tool, context)   ← org isolation, permissions, size, validate
    │
    ▼
PermissionService.enforceToolPermission()       ← RBAC via AuthorizationService
    │
    ▼
PermissionService.enforceOrganizationAccess()   ← org isolation check
    │
    ▼
Sandbox.executeWithTimeout(tool.execute())       ← timeout wrapper
    │
    ▼
Sandbox.auditExecution()                         ← audit log (success/failure)
    │
    ▼
ExecutionPipelineResult                        ← structured response
```

## Security

| Concern | Implementation |
|---------|---------------|
| No direct Prisma access | Tools call business services only (not PrismaService directly via sandbox) |
| Permission enforcement | Every tool declares `permissions` array; checked via AuthorizationService.authorize() |
| Organization isolation | Context org vs tool org comparison; enforced before execution |
| Input validation | Optional tool.validate() hook + input size limit (1MB default) |
| Execution timeout | Configurable timeout (30s default) prevents runaway executions |
| Sensitive data masking | Configurable field list masks credentials in audit logs |
| Audit trail | Every execution logged with event `ai.tool.executed` or `ai.tool.failed` |
| Error handling | Audit logs created even on failure; errors returned in structured `ExecutionPipelineResult`; never exposes internals |

## Test Coverage

| Module | Tests | Key Coverage |
|--------|-------|-------------|
| PromptRegistryService | 21 | register, get, getVersioned, getAllVersions, search, render, render-missing-var, render-default, validate, validate-missing-name, validate-missing-template, validate-undeclared-var, validate-duplicate, remove, remove-nonexistent, clearCache, getCacheSize |
| CapabilityRegistryService | 21 | register, get, has, getAll, getCount, findByTool, findByModel, findByProvider, getSupportedTools, getDefaultTemperature, getContextLimit, supportsStreaming, getProviderPreferences, remove, remove-nonexistent, update, update-nonexistent, search |
| ToolRegistryService | 16 | register, get, get-unknown, getAll, findByCategory, search, getToolDefinitions, getToolDefinition, getToolDefinition-unknown, remove, remove-nonexistent, getToolNames, getCategories, execute, duplicate-warn |
| MetadataService | 8 | getToolMetadata, getToolMetadata-nonexistent, getCapabilityMetadata, getPermissionMetadata, getAllMetadata, getProviderSupport, getClassMetadata, empty-class |
| AIPermissionService | 11 | no-permissions, has-permission, lacks-permission, auth-error, enforce-pass, enforce-fail, org-match, org-mismatch, org-no-tool-org, org-enforce-pass, org-enforce-fail |
| AISandboxService | 18 | validate-valid, validate-org-fail, validate-permission-fail, validate-input-size, validate-no-perms, enforce-valid, enforce-permission-exception, enforce-other-exception, mask-object, mask-json, mask-no-op, mask-primitive, mask-url, timeout-resolve, timeout-reject, timeout-error, audit-success, audit-failure |
| ExecutionPipelineService | 6 | execute-success, execute-unknown-tool, execute-sandbox-reject, execute-tool-failure, batch-execution, requestId |
| **Total** | **102** | |

## Verification

| Check | Result |
|-------|--------|
| `npm run build` | ✅ Passes |
| `npm run lint` | ✅ 0 errors (14 pre-existing `any` warnings) |
| `npm test` | ✅ **930/930 pass** (82 suites, +102 new tests) |
| `npx prisma validate` | ✅ Valid |

## Architecture Decisions

1. **No new Prisma models**: All registries operate in-memory (Map-based), appropriate for their runtime nature. Prompt files can be loaded from filesystem for persistence.
2. **Map-based registry pattern**: Follows existing `PaymentProviderFactory` (PaymentProviderFactory) and `ActionRegistryService` patterns exactly — `Map<string, T>` with `register()`, `get()`, `has()`, `remove()`.
3. **No direct Prisma in tools**: Tools receive input and return results through the sandbox. Business services are injected via NestJS DI and called within `execute()`.
4. **Double security enforcement**: Permissions checked in both sandbox (check) and pipeline (enforce) for defense-in-depth.
5. **Decorators as metadata only**: The `@AITool()` decorator stores metadata via `SetMetadata`. It does not auto-register the tool — registration happens in `onModuleInit()` for explicit lifecycle control.
6. **LLM function calling readiness**: `getToolDefinitions()` returns `ToolMetadata[]` matching the schema expected by OpenAI/Claude function calling APIs.
7. **Audit-first design**: Every execution (success or failure) is logged before returning. Audit failures never propagate to the caller (logged internally).
8. **Configurable defaults**: Cache TTL, sandbox timeout, max input size, sensitive fields, and audit toggle are all configurable via `ai.*` env/namespace values.

## What's NOT Implemented (Next Sprints)

- AI Agents (CEO, Finance, Sales, Inventory assistants)
- Memory (Session, Long-term, Organization)
- Conversation management
- RAG Engine
- Embeddings service
- MCP (Model Context Protocol)
- Task Queue / job scheduling
- Semantic Cache
- Observability (metrics, tracing)
- Frontend APIs (AI Workspace)
- Plugin system

All these will build on the AI Core Runtime established in this sprint.
