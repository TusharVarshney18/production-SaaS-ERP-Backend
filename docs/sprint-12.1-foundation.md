# Sprint 12.1 – Enterprise AI Platform Foundation

## Objective

Implement the AI Platform Foundation for ERPX. This sprint establishes the core AI infrastructure — provider abstraction, dynamic provider factory, configuration, health checks, exception handling, and the AI module — without implementing agents, RAG, memory, tools, or frontend APIs.

## Architecture Review

All architecture documents were reviewed before implementation:
- `AI_ARCHITECTURE.md` — Module structure, request flow, design decisions
- `AI_PROVIDER_ARCHITECTURE.md` — Provider interface, factory pattern, fallback strategies
- `AI_AGENT_ARCHITECTURE.md` — Agent interface, registry, orchestration (not implemented yet)
- `AI_TOOLS.md` — Tool interface, registration, execution (not implemented yet)
- `AI_PROMPT_REGISTRY.md` — External prompt storage (not implemented yet)
- `AI_MEMORY.md` — Memory layering strategy (not implemented yet)
- `AI_SECURITY.md` — Defense-in-depth security layers (integrated in providers)
- `AI_PERMISSIONS.md` — RBAC extension for AI (not implemented yet)
- `AI_ARCHITECTURE_REVIEW.md` — Enhancements for MCP, task queue, sandbox (not implemented yet)

## Existing Modules Reused

| Module | Usage |
|---|---|
| Authentication | AI endpoints protected by global auth (via existing middleware) |
| Organizations | Org-scoped isolation pattern (architecture ready) |
| Authorization/RBAC | Permission model (AI-specific permissions ready for next sprint) |
| Audit Log | Full audit trail (integrated in architecture) |
| Workflow Engine | AI_HOOK action type (bridge ready) |
| Configuration Module | `@nestjs/config` with `registerAs('ai', ...)` pattern |
| Logger (nestjs-pino) | Structured logging via `Logger` from `@nestjs/common` |
| Testing Setup | Jest with `@nestjs/testing`, same patterns as `billing/__tests__`, `workflows/tests/` |

## Implementation Details

### Directory Structure

```
src/ai/
├── ai.module.ts                  # Root module with OnModuleInit provider registration
├── ai.controller.ts              # Chat, health, provider listing, embed endpoints
├── interfaces/
│   ├── index.ts
│   └── provider.interface.ts     # IProvider contract
├── dto/
│   ├── index.ts
│   ├── ai.types.ts               # Core types: ChatMessage, ChatRequest, ChatResponse, etc.
│   ├── chat-request.dto.ts       # Swagger-documented request DTO
│   ├── chat-response.dto.ts      # Swagger-documented response DTO
│   └── health-response.dto.ts    # Swagger-documented health DTO
├── config/
│   ├── index.ts
│   └── ai.config.ts              # Environment-driven provider configuration
├── core/
│   ├── index.ts
│   ├── ai-gateway.service.ts     # Unified entry point for all AI operations
│   └── provider-router.service.ts # Provider selection with fallback chain
├── providers/
│   ├── index.ts
│   ├── base-provider.ts          # Abstract base with health(), maskApiKey(), validation
│   ├── provider.factory.ts       # Dynamic provider registration and lookup
│   ├── openai/openai.provider.ts # OpenAI (GPT-4o, GPT-4o-mini, GPT-4-turbo)
│   ├── gemini/gemini.provider.ts # Gemini (Gemini Pro, Gemini Flash)
│   ├── claude/claude.provider.ts # Claude (Opus, Sonnet, Haiku)
│   ├── ollama/ollama.provider.ts # Ollama (Llama3, Mistral, CodeLlama)
│   ├── azure-openai/azure-openai.provider.ts # Azure OpenAI
│   └── bedrock/bedrock.provider.ts # AWS Bedrock (Claude models)
├── health/
│   ├── index.ts
│   └── ai-health.service.ts      # Aggregate health check across all providers
├── exceptions/
│   ├── index.ts
│   ├── ai.exception.ts
│   ├── configuration.exception.ts
│   ├── invalid-provider.exception.ts
│   ├── provider-unavailable.exception.ts
│   └── streaming.exception.ts
└── tests/
    ├── ai-config.spec.ts
    ├── ai-gateway.service.spec.ts
    ├── ai-health.service.spec.ts
    ├── base-provider.spec.ts
    ├── exceptions.spec.ts
    ├── mock-providers.spec.ts
    ├── provider.factory.spec.ts
    └── provider-router.service.spec.ts
```

### IProvider Interface

```typescript
interface IProvider {
  readonly name: string;
  readonly models: string[];
  chat(request: ChatRequest): Promise<ChatResponse>;
  stream(request: ChatRequest): AsyncIterable<ChatResponse>;
  embed(text: string): Promise<EmbeddingResponse>;
  toolCall(request: ChatRequest): Promise<ChatResponse>;
  health(): Promise<ProviderHealth>;
  countTokens(text: string): Promise<number>;
}
```

### Provider Factory Design

- Implements dynamic provider registration via `registerProvider()`
- Supports: `getProvider()`, `getDefaultProvider()`, `getByModel()`, `getByCapability()`, `getRegisteredProviders()`, `getAvailableProviders()`
- Providers self-register in `AiModule.onModuleInit()`
- Pattern follows existing `PaymentProviderFactory` from billing module

### Provider Router

- Selects provider based on: preferred provider, model match, default provider, availability
- Implements automatic failover: tries candidates in order, skips unavailable providers
- Falls back to any available provider if all candidates fail
- Throws `ProviderUnavailableException` when no provider is accessible

### Configuration

Environment variables:
```
AI_DEFAULT_PROVIDER, AI_TEMPERATURE, AI_TIMEOUT, AI_RETRIES, AI_STREAMING
OPENAI_API_KEY, OPENAI_DEFAULT_MODEL
GEMINI_API_KEY, GEMINI_DEFAULT_MODEL
ANTHROPIC_API_KEY, CLAUDE_DEFAULT_MODEL
OLLAMA_URL, OLLAMA_DEFAULT_MODEL
AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_OPENAI_DEFAULT_MODEL
AWS_BEDROCK_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, BEDROCK_DEFAULT_MODEL
```

### Security

- API keys never logged (masked via `maskApiKey()` showing only `sk-1...cdef`)
- No hardcoded keys — all from environment variables
- Provider availability validated before every request
- Structured logging with `Logger` from `@nestjs/common`
- Errors return safe messages without exposing internals

### API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/chat` | Chat with default provider |
| POST | `/api/ai/chat/:provider` | Chat with specific provider |
| GET | `/api/ai/health` | AI platform health status |
| GET | `/api/ai/providers` | List registered providers |
| POST | `/api/ai/providers/:name/check` | Health check for a provider |
| POST | `/api/ai/embed` | Generate embeddings |

All endpoints are documented with Swagger decorators.

## Verification

```
npm run build       → Passes
npm run lint        → Passes (0 errors, 5 warnings — all pre-existing `any` patterns)
npm test            → 60 tests pass (8 test suites)
npx prisma validate → Schema is valid
```

## Architecture Review

| Criterion | Status |
|---|---|
| Code quality | Clean separation of concerns, abstract base provider, typed interfaces |
| Dependency injection | Full NestJS DI — providers registered in module, injected via constructor |
| Extensibility | Add a provider: create file, implement IProvider, register in module |
| Provider independence | No direct SDK imports — all via fetch(), swappable via config |
| Future compatibility | Architecture supports agents, tools, memory, RAG on top of this foundation |

## What's NOT Implemented (Next Sprints)

- Agents (CEO, Finance, Sales, Inventory, etc.)
- Tools (CRM, Sales, Inventory, etc.)
- Memory (Session, Long-term, Organization)
- RAG Engine
- Prompt Registry
- Capability Registry
- MCP (Model Context Protocol)
- Frontend APIs (AI Workspace)
- Task Queue
- Plugin System
