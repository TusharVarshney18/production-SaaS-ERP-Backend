# Sprint 12.4 — Enterprise Conversation & Memory

## Objective

Implement a production-grade Conversation & Memory system for ERPX. Supports multi-turn conversations, organization-scoped memory, user-scoped memory, session memory, and context window management. No RAG, embeddings, or vector search.

## Design Principles

- **Zero duplication**: Reuses Sprints 12.1-12.3 (providers, registries, pipeline, agents, context builder)
- **Provider abstraction**: `IConversationProvider`, `IMessageProvider`, `ISummaryProvider`, `IMemoryStorageProvider` interfaces designed for future PostgreSQL/Redis backends
- **In-memory by default**: `InMemory*Provider` implementations for all interfaces; swap providers for persistence
- **No Prisma models**: All data managed through provider interfaces, not database schemas
- **Organization + User isolation**: Every operation scoped to organizationId and optionally userId
- **Integration-ready**: Conversation Manager designed to integrate with Agent Executor and Context Builder

## Module Structure

```
src/ai/conversation/
├── interfaces/
│   ├── index.ts
│   ├── conversation.interface.ts              # Conversation, ConversationMessage, SessionState, MemoryEntry, types
│   └── memory-provider.interface.ts           # IConversationProvider, IMessageProvider, ISummaryProvider, IMemoryStorageProvider
├── providers/
│   ├── index.ts
│   └── in-memory.provider.ts                  # 4 InMemory implementations (conversation, message, summary, memory storage)
├── repositories/
│   ├── index.ts
│   ├── conversation.repository.ts             # Delegates to conversation + message + summary providers
│   └── memory.repository.ts                   # Delegates to memory storage provider
├── services/
│   ├── index.ts
│   ├── session-memory.service.ts              # Active session state management
│   ├── conversation-manager.service.ts        # Start/continue/end conversations
│   ├── conversation-history.service.ts         # History querying, tool/agent logs, summaries
│   ├── long-term-memory.service.ts            # User/org/AI memory CRUD
│   └── context-window.service.ts              # Token budgeting, trimming, memory injection
├── dto/
│   ├── index.ts
│   ├── conversation.dto.ts
│   └── memory.dto.ts
└── tests/
    ├── in-memory.provider.spec.ts             # 18 tests (3 providers)
    ├── session-memory.service.spec.ts         # 14 tests
    ├── conversation-manager.service.spec.ts   # 11 tests
    ├── conversation-history.service.spec.ts   # 9 tests
    ├── long-term-memory.service.spec.ts       # 11 tests
    └── context-window.service.spec.ts         # 6 tests
```

## Files Created (18 new files)

### Interfaces

| File | Purpose |
|------|---------|
| `conversation/interfaces/conversation.interface.ts` | `Conversation`, `ConversationMessage`, `ConversationSummary`, `SessionState`, `MemoryEntry` types; `ConversationStatus`, `MessageRole`, `MemoryType` enums |
| `conversation/interfaces/memory-provider.interface.ts` | `IConversationProvider`, `IMessageProvider`, `ISummaryProvider`, `IMemoryStorageProvider` — provider abstraction contracts |
| `conversation/interfaces/index.ts` | Barrel exports |

### Providers

| File | Purpose |
|------|---------|
| `conversation/providers/in-memory.provider.ts` | `InMemoryConversationProvider` (CRUD + list + count), `InMemoryMessageProvider` (add + get + delete + count + token sum), `InMemorySummaryProvider` (save + get + delete), `InMemoryMemoryStorageProvider` (CRUD + find + scope delete + TTL expiry) |

### Repositories

| File | Purpose |
|------|---------|
| `conversation/repositories/conversation.repository.ts` | Delegates to all three conversation/message/summary providers |
| `conversation/repositories/memory.repository.ts` | Delegates to memory storage provider |

### Services

| File | Purpose |
|------|---------|
| `conversation/services/session-memory.service.ts` | Per-user session state: create, get, pushMessage (cap at 50), temp variables, current agent/plan, end session, activity tracking |
| `conversation/services/conversation-manager.service.ts` | Full lifecycle: startConversation → addMessage (user/assistant/system/tool) → endConversation; throws on ended/nonexistent; updates messageCount + totalTokens; integrates with SessionMemory |
| `conversation/services/conversation-history.service.ts` | Query history with filters (includeToolCalls, includeSystemMessages); getToolExecutionHistory, getAgentSelectionHistory, getErrorHistory; save/get conversation summaries |
| `conversation/services/long-term-memory.service.ts` | Save/get/update/delete memories; findUserMemories, findOrganizationMemories, findMemoriesByTags; clearUserMemories/clearOrganizationMemories; getRelevantMemories (grouped by scope) |
| `conversation/services/context-window.service.ts` | buildContextWindow from session messages + relevant memories; trimMessages (preserves system, drops oldest non-system); estimateTokenCount; injects memory messages as system messages; token budget enforcement |

### DTOs

| File | Purpose |
|------|---------|
| `conversation/dto/conversation.dto.ts` | `StartConversationDto`, `ContinueConversationDto`, `ConversationResponseDto` |
| `conversation/dto/memory.dto.ts` | `SaveMemoryDto`, `MemoryResponseDto` |

## Business Logic

### Conversation Lifecycle

```
startConversation(orgId, userId, title?, agentName?)
    → Creates Conversation (id, orgId, userId, status='active')
    → Creates SessionState via SessionMemoryService
    → Returns Conversation

addMessage(conversationId, role, content, toolName?, agentName?)
    → Validates conversation exists and is not 'ended'
    → Estimates token count (content.length / 4)
    → Creates ConversationMessage with unique ID
    → Updates conversation messageCount + totalTokens
    → Pushes to SessionMemoryService (capped at 50 messages)
    → Returns ConversationMessage

endConversation(conversationId)
    → Sets status='ended', records endedAt
    → Ends session via SessionMemoryService
    → Returns updated Conversation
```

### Session Memory

| Feature | Implementation |
|---------|---------------|
| Active state | Map<`orgId:userId`, SessionState> |
| Message cap | Last 50 messages retained; oldest shifted when exceeded |
| Temporary variables | `Map<string, unknown>` per session, clearable |
| Current agent | Tracks which agent is handling the current request |
| Current plan | Tracks the active execution plan ID |
| Activity tracking | `lastActivityAt` updated on every pushMessage |

### Context Window Management

```
buildContextWindow(conversationId, orgId, userId, maxTokens?)
    ├── Get last messages from session
    ├── If total > budget → trimMessages() (preserve system, drop oldest non-system)
    ├── Get relevant memories from LongTermMemory
    ├── Convert memories to system messages with type metadata
    ├── If memory + message > budget → re-trim
    └── Return ContextWindow (messages, totalTokens, maxTokens, trimmedCount, injectedMemoryCount, summaryInjected)
```

### Long-Term Memory

| Operation | Scope | Isolation |
|-----------|-------|-----------|
| saveMemory | User or Organization | orgId required, userId optional |
| getMemory | orgId + key | userId filter for user-scoped |
| findUserMemories | orgId + userId | Filters by scope='user' |
| findOrganizationMemories | orgId | Filters by scope='organization' |
| findMemoriesByTags | orgId + tags | Optional userId filter |
| TTL | Per entry | Expired entries auto-deleted on access |

## Security

| Concern | Implementation |
|---------|---------------|
| Organization isolation | All memories/conversations keyed by `organizationId`; queries always filter by it |
| User isolation | User-scoped memories include `userId`; cross-user access prevented |
| No cross-tenant | Provider find/get always include organizationId in filter |
| Conversation state | Ended conversations reject new messages with `BadRequestException` |
| Memory TTL | Expired entries cleaned on read; no stale data returned |

## Test Coverage

| Module | Tests | Key Coverage |
|--------|-------|-------------|
| InMemoryConversationProvider | 7 | create, get, get-null, update, update-null, delete, list, count |
| InMemoryMessageProvider | 5 | add, limit, delete, count, totalTokens |
| InMemoryMemoryStorageProvider | 6 | save, findByType, update, delete, deleteByScope, scopeIsolation |
| SessionMemoryService | 14 | create, get, get-missing, pushMessage, messageCap50, tempVars, clearTempVars, setAgent, setPlan, endSession, endByConversation, activeCount, updateActivity, getByConversation |
| ConversationManagerService | 11 | start, startWithAgent, addUserMsg, addAssistantMsg, endedConvRejects, nonexistentConvRejects, endConversation, messageCountUpdate, getMessages, listConversations, delete |
| ConversationHistoryService | 9 | fullHistory, filterToolCalls, filterSystem, messageCount, totalTokens, toolHistory, agentHistory, errorHistory, saveAndGetSummary |
| LongTermMemoryService | 11 | saveAndGet, findUserMemories, findByType, findByTags, update, delete, clearUser, clearOrg, getRelevant, orgIsolation |
| ContextWindowService | 6 | buildFromSession, trimBudget, includeMemory, estimateTokens, trimCorrectly, preserveSystem |
| **Total** | **68** | |

## Verification

| Check | Result |
|-------|--------|
| `npm run build` | ✅ Passes |
| `npm run lint` | ✅ 0 errors (26 pre-existing `any` warnings) |
| `npm test` | ✅ **1056/1056 pass** (95 suites, +68 new tests) |
| `npx prisma validate` | ✅ Valid |

## Architecture Decisions

1. **Provider abstraction**: Four interfaces (`IConversationProvider`, `IMessageProvider`, `ISummaryProvider`, `IMemoryStorageProvider`) allow swapping in-memory for PostgreSQL/Redis without changing business logic.

2. **In-memory default**: All providers implemented as `@Injectable()` in-memory stores. Ready for production use with the option to implement persistent providers.

3. **No Prisma models**: Avoiding Prisma schema changes keeps the database migration-free. Memory/conversation data is managed entirely in application memory through the provider abstraction.

4. **Session message cap of 50**: Session memory retains the last 50 messages (configurable). This prevents unbounded memory growth while preserving enough context for meaningful conversation.

5. **Token estimation**: Uses `Math.ceil(text.length / 4)` for quick token estimation — same approach as existing providers. No external tokenizer dependency.

6. **System message preservation**: Context window trimmer always preserves system messages, only dropping non-system messages when budget is exceeded. This ensures system prompts and memory injections are never lost.

7. **Memory-to-message conversion**: Long-term memories are converted to system messages with `type` metadata for injection into the context window. This allows the LLM to see relevant memories without architectural changes to the provider pipeline.

8. **Repository layer**: Repositories sit between services and providers, enabling future cross-provider transactions (e.g., save conversation + message atomically) without changing service code.

## What's NOT Implemented (Next Sprints)

- Embeddings / Vector Search
- RAG (Retrieval-Augmented Generation)
- Knowledge Base
- MCP (Model Context Protocol)
- Task Queue / async job scheduling
- Semantic Cache
- Observability / tracing / metrics
- Frontend APIs (AI Workspace)
- PostgreSQL/Redis provider implementations
