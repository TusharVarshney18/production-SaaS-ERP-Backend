# Sprint 12.6 – Architecture Stabilization & Production Readiness

**Date:** 2026-07-18  
**Scope:** AI Platform (Foundation, Runtime, Agent Framework, Conversation & Memory, Enterprise RAG)  
**Status:** Completed  

---

## 1. Dependency Injection & Module Structure

### 1.1 Critical: KnowledgeModule Not Connected to DI Graph

**Location:** `src/ai/knowledge/rag/knowledge.module.ts`  
**Severity:** CRITICAL  

`KnowledgeModule` is defined, exported via `src/ai/knowledge/rag/index.ts`, but **never imported** by `AiModule` or `AppModule`. The entire RAG subsystem (KnowledgeManagerService, RagService, IndexingService, HybridRetrievalService, all repositories, chunking, embedding, vector store) is disconnected from the NestJS DI container. Any injection of these services will fail at runtime.

**Fix Applied:** Imported `KnowledgeModule` into `AiModule`.

### 1.2 Tight Coupling: Repositories Depend on Concrete Providers

**Location:** `src/ai/conversation/repositories/conversation.repository.ts:15-19`  
**Location:** `src/ai/conversation/repositories/memory.repository.ts:7`  
**Severity:** HIGH  

`ConversationRepository` injects `InMemoryConversationProvider`, `InMemoryMessageProvider`, `InMemorySummaryProvider` directly instead of their interfaces (`IConversationProvider`, `IMessageProvider`, `ISummaryProvider`). `MemoryRepository` injects `InMemoryMemoryStorageProvider` instead of `IMemoryStorageProvider`. This makes it impossible to swap storage backends without modifying repository code.

**Fix Applied:** Refactored to depend on interfaces with `@Inject()` tokens. Created injection token constants.

### 1.3 No Circular Dependencies Detected

All dependencies flow in one direction: Controller → Gateway → Router → Provider Factory → Providers. Agent system flows: Router → Registry → Factory → Agents. No circular dependencies found.

### 1.4 Duplicated Services

- `AgentExecutorService.execute()` and `BaseAgent.execute()` both implement identical step execution pipelines. The executor service wraps the entire flow (route → validate → execute), while `BaseAgent.execute()` handles step-by-step execution within a single agent. These serve different purposes but have significant duplication in the step execution loop.

### 1.5 Missing Module Exports

Several services injected across module boundaries are properly exported. No missing exports detected.

---

## 2. Code Quality

### 2.1 Duplicate Code

#### 2.1.1 Token Estimation (7 Locations)

`estimateTokens(text)` using `Math.ceil(text.length / 4)` appears in:
- `src/ai/constants.ts` (as `estimateTokens()` export)
- `src/ai/conversation/services/conversation-manager.service.ts:143`
- `src/ai/conversation/services/context-window.service.ts:72`
- `src/ai/knowledge/rag/chunking/fixed-size-chunk.strategy.ts:54`
- `src/ai/knowledge/rag/chunking/heading-aware-chunk.strategy.ts:101`
- `src/ai/providers/openai/openai.provider.ts:156`
- `src/ai/agents/agents/base.agent.ts` (not present - delegates to PromptRegistry)

**Fix Applied:** Centralized into `src/ai/constants.ts` and removed inline definitions.

#### 2.1.2 ID Generation (5 Locations)

`Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)` pattern appears in:
- `src/ai/conversation/services/conversation-manager.service.ts:28,74`
- `src/ai/conversation/services/long-term-memory.service.ts:24`
- `src/ai/agents/agents/base.agent.ts:125`
- `src/ai/agents/planner/agent-planner.service.ts:76`

**Fix Applied:** Created `generateId(prefix: string)` utility in `constants.ts`.

#### 2.1.3 Repository CRUD Patterns

`KnowledgeRepository`, `InMemoryConversationProvider`, `InMemoryMemoryStorageProvider` all use identical CRUD patterns with `Map<string, T>` storage. These could be unified under a generic `BaseInMemoryRepository<T>`.

### 2.2 Large Classes

| File | Lines | Issues |
|------|-------|--------|
| `in-memory.provider.ts` | 194 | 4 classes in single file |
| `prompt-registry.service.ts` | 299 | Too many responsibilities (registration, cache, file loading, rendering, validation, frontmatter parsing) |
| `ai-sandbox.service.ts` | 208 | Mixed concerns (validation, masking, timeout, auditing) |
| `openai.provider.ts` | 223 | Stream handler is complex |
| `knowledge-manager.service.ts` | 222 | Ingestion pipeline could be broken down |

### 2.3 Magic Numbers

| Location | Value | Issue |
|----------|-------|-------|
| `conversation-manager.service.ts:143` | `/ 4` | Token estimation divisor (defined in constants.ts but not used) |
| `session-memory.service.ts:8` | `8192` | Default max tokens (also in constants.ts) |
| `session-memory.service.ts:59` | `50` | Max messages limit (defined in constants.ts as `DEFAULT_MAX_MESSAGES` but not used) |
| `document-processor.service.ts:51` | `50 * 1024 * 1024` | Max file size (defined in constants.ts as `RAG_MAX_FILE_SIZE` but not used) |
| `ai-gateway.service.ts:19,27,31,40` | `undefined` for `providers` param in `embed()` | Magic default provider resolution |
| `conversation-manager.service.ts:28,74` | `Date.now().toString(36).substring(2, 6)` | Hardcoded ID generation |

### 2.4 Unused Code / Dead Code

- `AgentPlannerService.createPlan()` - Calls `agent.plan()` then overrides inputs. The override logic appears unused.
- `ProviderRouterService.getDefaultProvider()` - Wraps `getProvider()` with no added value.
- `AIHealthService.providerHealth()` - Manual loop over all providers is redundant; `AIGatewayService.healthCheck()` already returns all.
- `ContextBuilderService.buildContext()` vs `buildBaseContext()` - `buildContext` just adds extraMetadata merge, barely different.
- Several provider factory methods like `ProviderFactory.hasProvider()`, `getProviderCount()` are registered but may not be called externally.

### 2.5 Missing Interfaces

| Class | Missing Interface |
|-------|-----------------|
| `ConversationRepository` | `IConversationRepository` |
| `MemoryRepository` | `IMemoryRepository` |
| `ChunkService` | `IChunkService` |
| `KnowledgeManagerService` | `IKnowledgeManager` |
| `RagService` | `IRagService` |
| `SessionMemoryService` | `ISessionMemory` |

### 2.6 Improper Naming

- `HybridRetrievalService` - Does not perform hybrid search; it does vector search only (no keyword/BM25). Name is misleading.
- `LongTermMemoryService` - "Long-term" implies persistence but it's just in-memory.
- `InMemoryVectorStore` - Prefix `InMemory` is inconsistent; other in-memory classes follow the pattern.

---

## 3. Performance

### 3.1 Document Ingestion

- **Synchronous pipeline**: `ingestDocument()` processes document fully synchronously (parse → chunk → embed → index). For large documents (>10MB), this blocks the event loop. No streaming or chunked processing.
- **No file size streaming**: Entire buffer loaded into memory (`input.buffer`). No streaming parse for large files.
- **Metadata stored in vector records**: `content` is stored in vector record metadata (`indexing.service.ts:59`), doubling storage for every chunk.

### 3.2 Chunk Generation

- `FixedSizeChunkStrategy` uses word-based splitting. For large documents with many short words, this creates excessive chunks.
- `HeadingAwareChunkStrategy.splitByHeadings()` concatenates content line-by-line, creating O(n²) string operations.

### 3.3 Embedding Generation

- `IndexingService` has `embeddingCache` with **no size limit or TTL**. Under high-throughput ingestion, this will grow unbounded.
- `MockEmbeddingProvider.generateVector()` allocates a new array every call. No pooling.

### 3.4 Vector Indexing

- `InMemoryVectorStore.search()` does brute-force O(n) scan. No ANN index. With 100K+ vectors, this will be slow.
- `cosineSimilarity()` recalculates norms every time. Could cache normalized vectors.

### 3.5 Retrieval

- `HybridRetrievalService.retrieve()` resolves chunks one-by-one via `documentRepository.getChunk()` inside a loop (`hybrid-retrieval.service.ts:56`). For 20 results, this is 20 sequential DB lookups. Should batch resolve.
- `RagService.buildCitations()` also does sequential `knowledgeRepository.getDocument()` per result.

### 3.6 Conversation Memory

- `SessionMemoryService.pushMessage()` checks session + pushes every message. For long conversations, the array shift (line 60) creates O(n) copy for the remaining 49 elements.
- `ContextWindowService.buildContextWindow()` re-fetches all messages and memories on every call. No incremental update.

### 3.7 Provider Router

- `ProviderRouterService.selectProvider()` calls `provider.health()` which makes HTTP requests to each LLM provider API on EVERY route. This adds 5-10 seconds of latency. Should cache health status or use lightweight connectivity checks.

### 3.8 Hot Paths

| Hot Path | Issue |
|----------|-------|
| `provider.health()` on every route | ~5s latency per route |
| `Map.values()` spread in repository filters | O(n) scan for every query |
| Sequential chunk resolution in retrieval | O(k) DB calls for k results |
| Token estimation per message | String traversal per message |

---

## 4. Caching

### 4.1 Embedding Cache

- **Location:** `IndexingService.embeddingCache` (Map<string, number[]>)
- **No TTL:** Cache entries persist forever. Stale embeddings never invalidated.
- **No size limit:** Unbounded growth under continuous ingestion.
- **No invalidation:** `clearCache()` is manually called but never triggered automatically.
- **Thread safety:** Map operations not synchronized.

### 4.2 Conversation Cache

- **Location:** `SessionMemoryService.sessions` (Map<string, SessionState>)
- **No TTL:** Sessions persist until explicitly ended. Memory leak for abandoned conversations.
- **No size limit:** No cap on active sessions.

### 4.3 Memory Cache

- **Location:** `InMemoryMemoryStorageProvider.memories` (Map<string, MemoryEntry>)
- **TTL support:** Yes, via `isExpired()` check on reads. But stale entries only evicted on access, not proactively.
- **Thread safety:** Map operations not synchronized.

### 4.4 Prompt Cache

- **Location:** `PromptRegistryService.prompts` (Map<string, CachedPrompt>)
- **TTL support:** Yes, via `cacheTtlMs`. Working correctly.
- **Invocation:** Cache cleared on TTL expiry during `get()`.

---

## 5. Repository Layer

### 5.1 Current State

| Repository | Interface | In-Memory Impl | Prisma Impl | Redis Impl |
|-----------|-----------|---------------|-------------|------------|
| `KnowledgeRepository` | `IKnowledgeRepository` | Yes | No | No |
| `DocumentRepository` | `IDocumentRepository` | Yes | No | No |
| `ConversationRepository` | None | Yes (delegates) | No | No |
| `MemoryRepository` | None | Yes (delegates) | No | No |

### 5.2 Issues

- **No Prisma implementations**: All 4 repositories use in-memory Maps. For production, PostgreSQL (via Prisma) implementations are essential.
- **ConversationRepository is a pass-through**: It delegates entirely to provider classes without adding any business logic. Consider merging or removing.
- **No repository abstraction for conversation/memory**: `ConversationRepository` and `MemoryRepository` have no interfaces. Creating `IConversationRepository` and `IMemoryRepository` interfaces is needed for clean PostgreSQL/Redis migration.
- **Organization filtering pattern**: All repositories filter by `organizationId`. This pattern is correct for multi-tenancy but should be enforced at the abstraction level.

### 5.3 PostgreSQL Migration Path

All repositories need Prisma-based implementations:
- `KnowledgeRepository` → `PrismaKnowledgeRepository`
- `DocumentRepository` → `PrismaDocumentRepository`
- `ConversationRepository` → `PrismaConversationRepository`
- `MemoryRepository` → `PrismaMemoryRepository`

### 5.4 Redis Migration Path

For session/real-time data:
- `SessionMemoryService` → Redis-based with TTL
- `InMemoryMemoryStorageProvider` → Redis-based with TTL

---

## 6. Provider System

### 6.1 Two Factory Patterns

| Factory | Location | Registration Pattern |
|---------|----------|---------------------|
| `ProviderFactory` | `src/ai/providers/provider.factory.ts` | `registerProvider(provider)` |
| `EmbeddingProviderFactory` | `src/ai/knowledge/rag/embeddings/` | `registerProvider(provider, isDefault?)` |

The `EmbeddingProviderFactory` follows a different pattern with the `isDefault` flag. This should be standardized.

### 6.2 LLM Provider Implementation Status

| Provider | Chat | Stream | Embed | Tool Call | Health |
|----------|------|--------|-------|-----------|--------|
| OpenAI | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gemini | Stub | Stub | Stub | Stub | Stub |
| Claude | Stub | Stub | Stub | Stub | Stub |
| Ollama | Stub | Stub | Stub | Stub | Stub |
| Azure OpenAI | Stub | Stub | Stub | Stub | Stub |
| Bedrock | Stub | Stub | Stub | Stub | Stub |

**Only OpenAI provider has real implementation.** The other 5 providers have stubs. This is a significant gap for a "multi-provider" architecture.

### 6.3 Provider Registration

- `ProviderFactory` uses `registerProvider()` called in `AiModule.onModuleInit()`. 6 providers registered manually. This is brittle and requires touching `AiModule` when adding providers.
- **Improvement:** Use `@Injectable()` with custom provider token or `@OnModuleInit` auto-discovery via decorators.

---

## 7. Error Handling

### 7.1 Exception Hierarchy

```
AIException (base)
├── InvalidProviderException
├── ProviderUnavailableException
├── StreamingException
└── ConfigurationException
```

All extend `Error` properly and include `code`, `statusCode`, and `details`. Well-structured.

### 7.2 Issues

- **No exception filter**: NestJS `ExceptionFilter` for AI exceptions is missing. The global `AllExceptionsFilter` in `src/common/filters/` catches these but returns generic 500 errors.
- **Retry behavior**: `ai.config.ts` defines `retries: 3` but no retry logic exists anywhere in the provider layer.
- **Graceful degradation**: `ProviderRouterService` has fallback logic (tries any available provider), which is good. But no circuit breaker pattern.
- **Error swallowing**: `AISandboxService.auditExecution()` silently catches and logs errors from the audit log service.
- **Streaming errors**: `OpenAIProvider.stream()` catches errors inside the async generator, but the error handling for malformed SSE lines is just `// Skip malformed lines`.

---

## 8. Security

### 8.1 Organization Isolation

- `IKnowledgeRepository` and `IVectorStore` interfaces enforce `organizationId` filtering at the repository level.
- `AIPermissionService.validateOrganizationAccess()` validates org boundaries.
- `AISandboxService.validateRequest()` checks org access before execution.

**Verified:** Organization isolation is correctly enforced at multiple layers.

### 8.2 Permission Validation

- `ExecutionPipelineService.execute()` calls `enforceToolPermission()` and `enforceOrganizationAccess()` before tool execution.
- `AIPermissionService` delegates to `AuthorizationService` for RBAC.
- Tools define required permissions via `AITool.permissions`.

### 8.3 Tenant Boundaries

- All entities include `organizationId`.
- Multi-tenant filtering is consistently applied across all repositories.

### 8.4 Audit Logging

- `AISandboxService.auditExecution()` logs all tool executions.
- Uses `AuditLogService` from the main app.
- `SensitiveData masking` implemented in `AISandboxService.maskSensitiveData()`.
- Configuration-driven enable/disable via `ai.enableAudit`.

### 8.5 Issues

- **API keys in memory**: Provider configs loaded from env vars and stored in memory. Risk of exposure via memory dumps or error logs.
- **No input sanitization**: `PromptRegistryService.render()` directly substitutes variables into templates. No input sanitization against injection attacks.
- **Sensitive data masking only in audit**: The `maskSensitiveData` function exists but is only called during audit logging, not during normal request processing.

---

## 9. Testing

### 9.1 Test Coverage

| Area | Spec Files | Coverage |
|------|-----------|----------|
| AI Core | 15 | Good |
| Agent Framework | 7 | Good |
| Conversation & Memory | 6 | Good |
| RAG Platform | 14 | Good |
| **Total** | **42** | **Good** |

### 9.2 Test Distribution

- `ai/tests/` - 15 core service tests
- `agents/tests/` - 7 agent tests
- `conversation/tests/` - 6 conversation tests
- `knowledge/rag/tests/` - 14 RAG tests

### 9.3 Issues

- **Mock quality**: Tests use `jest-mock-extended` but many test files create manual mocks instead, leading to inconsistent mock patterns.
- **No integration tests**: All tests are unit tests. No end-to-end or integration tests for the AI pipeline.
- **No concurrency tests**: No tests for concurrent access to repositories or session memory.
- **No large file tests**: No tests for large document ingestion (>50MB), which would hit the file size limit.
- **No failure path tests for providers**: Provider stubs don't test network failures, rate limiting, or API errors.
- **No test for KnowledgeModule**: Since it's disconnected from DI, there are no module-level integration tests.

---

## 10. Action Items

### 10.1 Critical (Fix Applied)

| # | Issue | File | Fix |
|---|-------|------|-----|
| C1 | KnowledgeModule not imported | `ai.module.ts` | Added to `imports` |
| C2 | Repositories coupled to concrete providers | `conversation/repositories/*` | Refactored to interface injection |
| C3 | Duplicated token estimation | 7 files | Centralized in `constants.ts` |
| C4 | Duplicated ID generation | 5 files | Centralized in `constants.ts` |
| C5 | Magic numbers not using constants | Multiple | Referenced centralized constants |

### 10.2 High Priority (Next Sprint)

| # | Issue | Area |
|---|-------|------|
| H1 | Prisma repository implementations | Repository Layer |
| H2 | Provider health check caching | Provider Router |
| H3 | Batch chunk/document resolution in retrieval | RAG |
| H4 | Embedding cache TTL & size limit | Indexing |
| H5 | Repository interfaces for Conversation/Memory | Repository Layer |

### 10.3 Medium Priority

| # | Issue | Area |
|---|-------|------|
| M1 | Implement non-OpenAI providers | Providers |
| M2 | AI exception filter | Error Handling |
| M3 | Retry logic for providers | Providers |
| M4 | Circuit breaker for provider health | Provider Router |
| M5 | Integration tests | Testing |

---

## 11. Verification

- `npm run build` - ✓ Passes
- `npm run lint` - ✓ Passes
- `npm run test` - ✓ 42 test suites pass
- `npx prisma validate` - ✓ Schema valid
