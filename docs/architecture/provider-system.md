# Provider System Architecture

## Overview

The AI platform uses a provider-based architecture for external AI service integration. There are two distinct provider systems:

1. **LLM Providers** - Chat, streaming, embedding, tool calling
2. **Embedding Providers** - Text embedding generation for RAG

## LLM Provider System

### Interface

```
IProvider (src/ai/interfaces/provider.interface.ts)
  ├── name: string
  ├── models: string[]
  ├── chat(request: ChatRequest): Promise<ChatResponse>
  ├── stream(request: ChatRequest): AsyncIterable<ChatResponse>
  ├── embed(text: string): Promise<EmbeddingResponse>
  ├── toolCall(request: ChatRequest): Promise<ChatResponse>
  ├── health(): Promise<ProviderHealth>
  └── countTokens(text: string): Promise<number>
```

### Base Class

```
BaseProvider (src/ai/providers/base-provider.ts)
  └── abstract class implementing IProvider
        ├── health() - default implementation with checkAvailability()
        ├── validateAvailability() - checks if provider is enabled
        ├── maskApiKey() - key masking utility
        └── Abstract methods: chat, stream, embed, toolCall, countTokens, checkAvailability
```

### Implementations

| Provider | Status | Real Implementation |
|----------|--------|-------------------|
| OpenAI | ✅ | Full chat, stream, embed, toolCall, health |
| Gemini | ⏳ | Stub only |
| Claude | ⏳ | Stub only |
| Ollama | ⏳ | Stub only |
| Azure OpenAI | ⏳ | Stub only |
| Bedrock | ⏳ | Stub only |

### Registration Pattern

```
ProviderFactory (singleton, @Injectable)
  ├── registerProvider(provider: IProvider) - called in AiModule.onModuleInit()
  ├── getProvider(name: string) - returns registered provider or throws
  ├── getDefaultProvider(name) - same as getProvider
  ├── getByModel(model) - finds provider supporting a specific model
  ├── getByCapability(capability) - filters by capability type
  └── getRegisteredProviders() - returns names
```

### Factory

```
ProviderFactory (src/ai/providers/provider.factory.ts)
  - Map<string, IProvider> storage
  - Manual registration in onModuleInit()
  - No auto-discovery mechanism
```

## Embedding Provider System

### Interface

```
IEmbeddingProvider (src/ai/knowledge/rag/interfaces/embedding-provider.interface.ts)
  ├── name: string
  ├── dimensions: number
  ├── generateEmbedding(text: string): Promise<number[]>
  └── generateEmbeddings(texts: string[]): Promise<number[][]>
```

### Registration Pattern

```
EmbeddingProviderFactory
  ├── registerProvider(provider, isDefault?) - different from LLM pattern
  └── getProvider(name?) - returns by name or default
```

### Implementations

| Provider | Status |
|----------|--------|
| MockEmbeddingProvider | ✅ Generates random normalized vectors (384d) |

## Memory Provider System

### Interfaces

```
IConversationProvider - CRUD for conversations
IMessageProvider - CRUD for messages
ISummaryProvider - CRUD for summaries
IMemoryStorageProvider - CRUD for memory entries with TTL
```

### Implementations (all in-memory)

```
InMemoryConversationProvider - Map<string, Conversation>
InMemoryMessageProvider - Map<string, ConversationMessage[]>
InMemorySummaryProvider - Map<string, ConversationSummary>
InMemoryMemoryStorageProvider - Map<string, MemoryEntry> with TTL support
```

## Vector Store Provider

### Interface

```
IVectorStore (src/ai/knowledge/rag/interfaces/vector-store.interface.ts)
  ├── upsert(records) - insert or update vectors
  ├── search(query, options) - cosine similarity search
  ├── delete(ids) - delete by IDs
  ├── deleteByDocumentId(docId, orgId) - delete all for doc
  └── deleteByOrganizationId(orgId) - delete all for org
```

### Implementation

```
InMemoryVectorStore
  - Brute-force cosine similarity search (O(n))
  - Organization-level isolation
  - Metadata filtering support
```

## Standardization Recommendations

1. **Unify provider registration**: Both `ProviderFactory` and `EmbeddingProviderFactory` should use the same registration pattern.
2. **Auto-discovery**: Use `@Injectable()` with a custom provider token to enable auto-registration without touching module files.
3. **Health check caching**: Provider health checks should be cached with TTL to avoid HTTP calls on every route.
4. **Circuit breaker**: Implement circuit breaker pattern for provider health checks.
5. **Retry logic**: Implement the `retries: 3` config value with exponential backoff.
