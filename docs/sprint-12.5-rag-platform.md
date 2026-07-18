# Sprint 12.5 — Enterprise RAG & Knowledge Platform

## Overview

Implements a complete Enterprise Retrieval-Augmented Generation (RAG) platform
integrated into the existing AI Runtime. Agents can retrieve organization
knowledge securely as an additional context source.

## Architecture

```
Agent (CEO, Finance, etc.)
    │
    ▼
RagService.query()
    │
    ├── HybridRetrievalService
    │       ├── EmbeddingProviderFactory → IEmbeddingProvider
    │       ├── InMemoryVectorStore → IVectorStore
    │       └── RankerService
    │
    ▼
KnowledgeManagerService
    ├── DocumentProcessorService (validate → extract → clean → normalize)
    ├── ChunkService
    │       ├── FixedSizeChunkStrategy
    │       └── HeadingAwareChunkStrategy
    ├── IndexingService (embed + store + cache)
    └── Repositories
            ├── KnowledgeRepository (documents/versions)
            └── DocumentRepository (chunks)
```

## Directory Structure

```
src/ai/knowledge/rag/
    interfaces/          — IEmbeddingProvider, IVectorStore, IDocumentParser, IChunkStrategy
    dto/                 — document, chunk, embedding, retrieval, knowledge DTOs
    embeddings/          — EmbeddingProviderFactory + MockEmbeddingProvider
    vector/              — InMemoryVectorStore
    documents/           — DocumentParserService + DocumentProcessorService
    chunking/            — FixedSizeChunkStrategy, HeadingAwareChunkStrategy, ChunkService
    providers/           — Placeholder for future source providers (SharePoint, etc.)
    repositories/        — KnowledgeRepository + DocumentRepository
    retrieval/           — HybridRetrievalService + RankerService
    indexing/            — IndexingService (embedding cache, vector storage)
    rag/                 — RagService (query, context assembly, citations)
    tests/               — 14 test suites, 78 tests
    knowledge-manager.service.ts
    knowledge.module.ts
```

## Key Components

### Interfaces (provider-agnostic)

| Interface | Purpose | Future Implementations |
|-----------|---------|----------------------|
| `IEmbeddingProvider` | Generate embeddings | OpenAI, Azure OpenAI, Voyage, Cohere, Google |
| `IVectorStore` | Store/search vectors | pgvector, Qdrant, Pinecone, Weaviate, Milvus, Redis |
| `IDocumentParser` | Parse file formats | PDF, DOCX, TXT, MD, CSV (+ website, SharePoint, etc.) |
| `IChunkStrategy` | Text chunking | Fixed-size, heading-aware (+ semantic, recursive) |

### Embedding Provider Factory

- Registers providers by name (`EmbeddingProviderFactory`)
- Ships with `MockEmbeddingProvider` (384d, unit vectors)
- Register real providers: `factory.registerProvider(myOpenAIProvider)`
- No hardcoded OpenAI or any vendor

### Document Pipeline

1. **Validation** — checks file name, buffer, MIME type, size limit (50MB)
2. **Parsing** — supports TXT, MD, CSV, PDF (text extraction), DOCX (XML parsing)
3. **Cleaning** — removes control chars, normalizes whitespace, collapses newlines
4. **Normalization** — unicode smart quotes → straight quotes, em-dashes → hyphens

### Chunking

| Strategy | Description |
|----------|-------------|
| `FixedSizeChunkStrategy` | Configurable chunk size + overlap (default: 512 tokens, 64 overlap) |
| `HeadingAwareChunkStrategy` | Splits at `# heading` boundaries, preserves heading metadata |

Token estimation via `Math.ceil(text.length / 4)`.

### Vector Store

`InMemoryVectorStore` with cosine similarity search supporting:
- Organization isolation (no cross-tenant)
- Metadata filtering
- Document ID filtering
- Score threshold
- Top-K limiting

### Retrieval

- **HybridRetrievalService** — query → embed → vector search → rank → return
- **RankerService** — score-based ranking + source priority reranking
- Full org isolation, no cross-tenant data leakage

### Knowledge Manager

Manages full lifecycle:
- `ingestDocument()` — upload → validate → parse → chunk → embed → index → version
- `deleteDocument()` — remove vectors + chunks + metadata
- `getStats()` — document/chunk counts, storage estimates
- Version tracking via `DocumentVersion` records

### RAG Service

- `query()` — retrieve + rank + assemble citations
- `queryWithSourcePriority()` — rerank by source weight
- `buildContextString()` — produce prompt-ready context with source citations
- Returns `RagResponse` with `results`, `citations`, `processingTimeMs`

## Security

- **Organization isolation** — all queries filter by `organizationId`
- **Document ownership** — documents linked to uploader + org
- **No cross-tenant retrieval** — enforced in vector store, repositories, and services

## Integration Points

### Agent Integration

Agents can request knowledge by injecting `RagService`:

```typescript
const response = await ragService.query({
  query: "What is the Q3 revenue?",
  organizationId: context.organizationId,
  topK: 5,
});
```

### Conversation Memory Integration

`RagService.buildContextString()` produces context ready for injection into
`ContextWindowService` as system messages with source citations.

### Module Registration

```typescript
// In AiModule or AppModule
import { KnowledgeModule } from './knowledge/rag/knowledge.module';

@Module({
  imports: [KnowledgeModule],
})
export class AppModule {}
```

## Performance Features

- **Embedding cache** — in-memory cache avoids re-embedding identical text
- **Chunk cache** — via IndexingService deduplication
- **Lazy indexing** — chunks are indexed on ingest; no background worker required
- **Streaming-ready** — RAG service uses async/await throughout

## Testing

78 tests across 14 suites:

| Suite | Tests | Coverage |
|-------|-------|----------|
| MockEmbeddingProvider | 5 | dimensions, generation, unit vectors |
| EmbeddingProviderFactory | 6 | registration, lookup, fallback |
| InMemoryVectorStore | 9 | upsert, search, org isolation, filter, delete |
| DocumentParserService | 8 | TXT, MD, CSV, PDF, DOCX, error |
| DocumentProcessorService | 7 | process, clean, validate, normalize |
| FixedSizeChunkStrategy | 5 | chunking, overlap, empty, metadata |
| HeadingAwareChunkStrategy | 4 | headings, metadata, no-headings, multi-section |
| ChunkService | 6 | strategy selection, delegation |
| KnowledgeRepository | 5 | CRUD, list, count, versions |
| DocumentRepository | — (covered by integration) |
| HybridRetrievalService | 3 | search, org isolation, topK |
| RankerService | 4 | ranking, reranking |
| IndexingService | 4 | index, delete, cache |
| KnowledgeManagerService | 7 | ingest, list, isolation, stats, delete, retry |
| RagService | 5 | query, citations, context, isolation, rerank |

## Verification Results

- `npm run build` — clean
- `npm run lint` — 0 errors (27 pre-existing warnings in unrelated files)
- `npm test` — 366 tests pass (42 suites)
- `npx prisma validate` — valid schema
