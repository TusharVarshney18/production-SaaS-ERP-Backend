# Retrieval Augmented Generation (RAG) Architecture

## Overview

RAG enables the AI platform to answer questions about organization-specific documents, policies, and knowledge without fine-tuning. It retrieves relevant context from a knowledge base and injects it into the LLM prompt.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RAG ENGINE                                  │
│                                                                      │
│  User Query                                                          │
│      │                                                               │
│      ▼                                                               │
│  RAGEngine.answer(query, context)                                    │
│      │                                                               │
│      ├──→ 1. Rewrite query for retrieval (optional)                  │
│      ├──→ 2. Generate embedding vector                               │
│      ├──→ 3. Hybrid search: vector + keyword                         │
│      ├──→ 4. Rerank results by relevance                             │
│      ├──→ 5. Build augmented prompt with context                     │
│      ├──→ 6. Call LLM with augmented prompt                          │
│      └──→ 7. Return answer + sources                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Document Ingestion Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Source  │───→│  Parser  │───→│  Chunker │───→│  Embedder│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                     │
                                                     ▼
                                              ┌──────────┐
                                              │  Vector  │
                                              │   Store  │
                                              └──────────┘
```

### Sources (v1)

| Source | Parser | Format |
|---|---|---|
| Organization policies | Markdown parser | `.md` files in `knowledge/org/{orgId}/` |
| ERP documentation | Markdown parser | `knowledge/docs/` |
| Knowledge base entries | Direct text | Stored in `knowledge_base_entries` table |
| Company documents | Text/Markdown | Manual upload → stored + indexed |

### Future Sources (v2+)

- PDF documents (pdf.js parsing)
- SharePoint integration
- Google Drive integration
- Email archives
- Slack history

### Chunking Strategy

```typescript
interface ChunkConfig {
  chunkSize: number;         // 512 tokens (default)
  chunkOverlap: number;      // 64 tokens (10% overlap)
  separator: string;         // '\n\n' (paragraph boundary)
  strategy: 'recursive' | 'semantic' | 'fixed';
}
```

- **Recursive**: Split by paragraphs → sentences → tokens (preserves context)
- **Semantic**: Split at natural topic boundaries (future)
- **Fixed**: Split at exact token count (simplest, least accurate)

## Vector Store

| Property | Value (v1) | Future |
|---|---|---|
| Engine | PostgreSQL + `pgvector` | Pinecone, Weaviate |
| Extension | `CREATE EXTENSION vector` | Managed service |
| Dimension | 1536 (OpenAI text-embedding-3-small) | Configurable |
| Index type | IVFFlat (faster queries) | HNSW (higher accuracy) |
| Distance | Cosine similarity | |

## Hybrid Search

```
User Query
    │
    ├──→ Vector Search (semantic similarity)
    │       │
    │       └──→ "How do I create a purchase order?"
    │             └──→ Matches: "Creating purchase orders in procurement"
    │
    ├──→ Keyword Search (BM25 / full-text)
    │       │
    │       └──→ "create purchase order"
    │             └──→ Matches: "Create Purchase Order" (exact title)
    │
    └──→ Hybrid Score = α * vector_score + β * keyword_score
          (α = 0.7, β = 0.3, configurable per org)
```

## Reranking

After initial retrieval, results are reranked using a cross-encoder model:

```typescript
interface Reranker {
  rerank(query: string, results: SearchResult[], topK: number): Promise<SearchResult[]>;
}
```

- v1: Use LLM itself to rerank (call with: "Which of these documents is most relevant?")
- v2: Deploy a dedicated cross-encoder model (Cohere rerank, BGE-reranker)

## Augmented Prompt

```
You are an AI assistant for the ERPX ERP system.

Answer the user's question based on the following context documents.
If the context doesn't contain enough information, say so.
Always cite the source document name.

CONTEXT:
---
Source: procurement-policies.md (Relevance: 0.95)
Purchasing Policy: All purchase orders above $10,000 require manager approval...
---
Source: user-guide.md (Relevance: 0.87)
To create a purchase order, navigate to Procurement → Purchase Orders → New...
---

User Question: How do I create a purchase order over $10,000?
```

## Knowledge Base Schema

```typescript
// knowledge_base_entries table
interface KnowledgeBaseEntry {
  id: string;
  organizationId: string;
  title: string;
  content: string;            // Markdown or plain text
  source: string;             // 'policy' | 'documentation' | 'manual_upload' | 'ai_generated'
  sourceUrl?: string;
  tags: string[];
  status: 'active' | 'archived';
  embedding: Float32Array;    // pgvector column
  tokenCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// knowledge_base_chunks table
interface KnowledgeBaseChunk {
  id: string;
  entryId: string;
  index: number;              // Position in document
  content: string;            // Chunk text
  embedding: Float32Array;
  tokenCount: number;
}
```

## RAG Service Interface

```typescript
interface IRAGEngine {
  answer(
    query: string,
    context: RAGContext,
  ): Promise<RAGResponse>;

  index(entry: KnowledgeBaseEntry): Promise<void>;
  reindex(entryId: string): Promise<void>;
  delete(entryId: string): Promise<void>;
}

interface RAGContext {
  organizationId: string;
  userId: string;
  topK: number;               // Number of chunks to retrieve
  minScore: number;           // Minimum similarity score (0-1)
}

interface RAGResponse {
  answer: string;
  sources: SourceDocument[];
  tokenUsage: { prompt: number; completion: number };
}

interface SourceDocument {
  title: string;
  source: string;
  relevance: number;
  excerpt: string;
}
```

## Security in RAG

- Documents are scoped to organizations (cross-org leakage prevented)
- Sensitive document filtering (finance documents may be restricted by role)
- Document-level permissions (some policies may be admin-only)
- All RAG queries are audited (what was retrieved, what was returned)
