# AI Platform Architecture Overview

## System Context

The AI platform is a sub-system within the ERPX multi-tenant SaaS backend. It provides LLM-powered conversational AI, RAG-based knowledge retrieval, and multi-agent orchestration.

## Module Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AiModule (root)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  AI Controller                        │   │
│  │  POST /ai/chat │ POST /ai/chat/:provider             │   │
│  │  GET /ai/health │ GET /ai/providers                   │   │
│  └──────┬───────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────▼───────────────────────────────────────────────┐   │
│  │              AIGatewayService                         │   │
│  │  chat() │ stream() │ embed() │ toolCall()             │   │
│  └──────┬───────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────▼───────────────────────────────────────────────┐   │
│  │            ProviderRouterService                      │   │
│  │  selectProvider() → health check → fallback           │   │
│  └──────┬───────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────▼───────────────────────────────────────────────┐   │
│  │              ProviderFactory                          │   │
│  │  registerProvider() │ getProvider() │ getByModel()    │   │
│  └──────┬───────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────┼─────────┬──────────┬──────────┬──────────┐    │
│  ▼      ▼         ▼          ▼          ▼          ▼     │
│ OpenAI  Gemini   Claude    Ollama   Azure      Bedrock   │
│  (real)  (stub)   (stub)   (stub)    (stub)    (stub)    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              KnowledgeModule (RAG Subsystem)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Document  │  │ Chunking │  │Embedding │  │ Vector   │   │
│  │Processor │→ │ Service  │→ │ Factory  │→ │ Store    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       │              │              │              │        │
│  ┌────▼──────┐ ┌─────▼──────┐ ┌────▼──────┐              │
│  │Knowledge  │ │ Document   │ │ Indexing  │              │
│  │Repository │ │ Repository │ │ Service   │              │
│  └───────────┘ └────────────┘ └───────────┘              │
│       │                                                    │
│  ┌────▼───────────────────────────────────────────────┐   │
│  │              RagService                              │   │
│  │  query() │ queryWithSourcePriority()                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│            Agent Framework Subsystem                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │   │
│  │ Registry │→ │ Factory  │→ │ Router   │→ │Executor  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       │                                                    │
│  ┌────▼───────────────────────────────────────────────┐   │
│  │  Concrete Agents: CEO, Finance, Sales, Inventory,  │   │
│  │  HR, Reporting, Developer                          │   │
│  └─────────────────────────────────────────────────────┘   │
│       │                                                    │
│  ┌────▼───────────────────────────────────────────────┐   │
│  │  Supporting Services                                 │   │
│  │  ContextBuilder │ Planner │ Pipeline                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│          Conversation & Memory Subsystem                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Conversation │  │   Session    │  │  Context Window  │  │
│  │   Manager    │→│   Memory     │→│    Service        │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│       │                                                    │
│  ┌────▼───────────────────────────────────────────────┐   │
│  │  LongTermMemoryService ↔ MemoryRepository           │   │
│  │  ConversationHistoryService                         │   │
│  └─────────────────────────────────────────────────────┘   │
│       │                                                    │
│  ┌────▼───────────────────────────────────────────────┐   │
│  │  In-Memory Providers (Swappable via DI tokens)     │   │
│  │  IConversationProvider │ IMessageProvider           │   │
│  │  ISummaryProvider │ IMemoryStorageProvider          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Dependency Flow

```
Controller → Gateway → Router → Factory → LLM Providers
Controller → HealthService → Gateway
Gateway → PromptRegistry
Gateway → AgentRouter → AgentRegistry → AgentFactory → Agents
AgentExecutor → AgentRouter → AgentPlanner → Pipeline
Pipeline → Sandbox → PermissionService → AuditLog
Pipeline → ToolRegistry → AITools
ContextBuilder → ToolRegistry → CapabilityRegistry → ProviderFactory
ConversationManager → ConversationRepository → Providers
LongTermMemory → MemoryRepository → StorageProvider
ContextWindow → SessionMemory → LongTermMemory
RagService → HybridRetrieval → VectorStore → EmbeddingFactory
KnowledgeManager → DocumentProcessor → ChunkService → IndexingService
IndexingService → EmbeddingFactory → VectorStore → DocumentRepository
```

## Key Design Decisions

1. **Provider abstraction via `IProvider` interface**: All LLM providers implement a common interface, enabling swap-ability.
2. **Repository pattern with interface injection**: `ConversationRepository` and `MemoryRepository` depend on storage interfaces (not concrete classes), enabling future PostgreSQL/Redis implementations.
3. **Factory + Registry pattern**: LLM providers, embedding providers, agents, tools, capabilities, and prompts all use registry-based registration.
4. **Multi-tenant isolation**: All entities carry `organizationId`; repositories filter by it.
5. **Sandbox execution**: Tool execution passes through `AISandboxService` for validation, permission enforcement, timeout, and audit logging.
