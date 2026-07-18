# AI Module Dependency Map

## Module Dependencies

```
AppModule
  ├── PrismaModule (@Global)
  ├── HealthModule
  ├── AuthModule
  ├── OrganizationsModule
  ├── ... (20+ business modules)
  ├── WorkflowsModule
  └── AiModule
        ├── ConfigModule.forFeature(aiConfig)
        ├── AuthorizationModule
        │     └── AuthorizationService (permission checks)
        ├── AuditLogModule
        │     └── AuditLogService (execution auditing)
        └── KnowledgeModule (RAG subsystem)
```

## Service Dependency Graph

### AI Core

```
AIController
  ├── AIGatewayService
  │     ├── ProviderFactory
  │     └── ProviderRouterService
  │           ├── ProviderFactory
  │           └── ConfigService
  ├── AIHealthService
  │     └── AIGatewayService
  └── ProviderFactory
```

### Agent Framework

```
AgentExecutorService
  ├── AgentRouterService
  │     ├── AgentFactoryService → AgentRegistryService
  │     └── CapabilityRegistryService
  ├── AgentPlannerService
  │     ├── PromptRegistryService
  │     └── ToolRegistryService
  ├── ExecutionPipelineService
  │     ├── ToolRegistryService
  │     ├── AISandboxService
  │     │     ├── ConfigService
  │     │     ├── AIPermissionService
  │     │     │     └── AuthorizationService
  │     │     └── AuditLogService
  │     └── AIPermissionService
  ├── PromptRegistryService
  └── AIGatewayService

ContextBuilderService
  ├── ConfigService
  ├── ToolRegistryService
  ├── CapabilityRegistryService
  └── ProviderFactory

BaseAgent (abstract)
  ├── PromptRegistryService
  ├── ToolRegistryService
  └── ExecutionPipelineService

Concrete Agents (CeoAgent, FinanceAgent, etc.)
  └── BaseAgent
```

### Conversation & Memory

```
ConversationManagerService
  ├── ConversationRepository
  │     ├── @Inject(IConversationProvider)
  │     │     └── InMemoryConversationProvider
  │     ├── @Inject(IMessageProvider)
  │     │     └── InMemoryMessageProvider
  │     └── @Inject(ISummaryProvider)
  │           └── InMemorySummaryProvider
  └── SessionMemoryService

ConversationHistoryService
  └── ConversationRepository

LongTermMemoryService
  └── MemoryRepository
        └── @Inject(IMemoryStorageProvider)
              └── InMemoryMemoryStorageProvider

ContextWindowService
  ├── SessionMemoryService
  └── LongTermMemoryService
```

### RAG Subsystem (KnowledgeModule)

```
KnowledgeManagerService
  ├── DocumentProcessorService
  │     └── DocumentParserService
  ├── ChunkService
  │     ├── FixedSizeChunkStrategy
  │     └── HeadingAwareChunkStrategy
  ├── IndexingService
  │     ├── @Inject(IVectorStore)
  │     │     └── InMemoryVectorStore
  │     ├── EmbeddingProviderFactory
  │     │     └── @Inject(IEmbeddingProvider)
  │     │           └── MockEmbeddingProvider
  │     └── @Inject(IDocumentRepository)
  │           └── DocumentRepository
  ├── KnowledgeRepository
  └── DocumentRepository

RagService
  ├── HybridRetrievalService
  │     ├── @Inject(IVectorStore) → InMemoryVectorStore
  │     ├── EmbeddingProviderFactory → MockEmbeddingProvider
  │     ├── @Inject(IDocumentRepository) → DocumentRepository
  │     └── RankerService
  ├── RankerService
  └── KnowledgeRepository
```

## Circular Dependency Check

**Status: NO CIRCULAR DEPENDENCIES DETECTED**

All dependencies flow in one direction:
- Controller → Service → Repository → Provider
- Gateway → Router → Factory → Provider
- Executor → Router → Registry → Agent
- Manager → Repository → Provider (interface → implementation)

## Duplicate Service Check

| Service | Purpose | Duplicate? |
|---------|---------|------------|
| `BaseAgent.execute()` | Agent step execution | Yes, overlaps with `AgentExecutorService.executePlan()` |
| `estimateTokens()` in 7 files | Token estimation | Fixed - centralized in `constants.ts` |
| `generateId()` in 5 files | ID generation | Fixed - centralized in `constants.ts` |
| Repository CRUD patterns | Map-based storage | Pattern repeated across 4 repositories |
