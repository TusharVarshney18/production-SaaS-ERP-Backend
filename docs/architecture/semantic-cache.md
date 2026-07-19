# Semantic Cache Architecture

## Overview

The Semantic Cache is a provider-independent caching layer that reduces repeated AI computation by storing and reusing previous results. It supports exact-match and semantic-similarity lookups across 10 cache categories.

## Core Data Flow

```
SemanticCacheService.getOrSet(request, compute)
  │
  ├── Step 1: Exact key lookup
  │     key = generateKey(category, orgId, query)
  │     if (provider.get(key, orgId)) return hit
  │
  ├── Step 2: Semantic similarity
  │     similar = matcher.findSimilar(query, orgId, category)
  │     if (similar[0].score >= minScore) return semanticHit
  │
  ├── Step 3: Execute (cache miss)
  │     value = await compute()
  │
  ├── Step 4: Store result
  │     policy = policyManager.getPolicy(category)
  │     if (shouldEvict) selectEvictionCandidates → delete
  │     provider.set(key, value, orgId, category, { ttl })
  │     metrics.recordSave(category, duration)
  │
  └── Return value
```

## Key Generation

```
key = "cache:{category}:{organizationId}:{sha256(parts).substring(0,16)}"
```

Example: `cache:llm.response:org-1:a1b2c3d4e5f6g789`

## Cache Entry Metadata

```typescript
interface CacheEntryMetadata {
  createdAt: number;
  accessedAt: number;
  ttl?: number;           // Time-to-live from creation
  slidingTtl?: number;     // Time-to-live from last access
  accessCount: number;
  organizationId: string;
  category: string;
  tags: string[];
  size: number;           // Estimated byte size
}
```

## Invalidation Events

| Event Type | Trigger | Effect |
|-----------|---------|--------|
| `manual` | API call | Delete by key, category, tags, or all |
| `ttl` | Time-based | Auto-deleted on access if expired |
| `knowledge_update` | Knowledge change | Delete knowledge cache category |
| `document_reindex` | Document re-index | Delete RAG results |
| `conversation_reset` | Conversation end | Delete conversation summaries |
| `organization_clear` | Org data purge | Delete all cache for org |

## Integration Points

| AI Subsystem | Cache Category | Integration |
|-------------|----------------|-------------|
| AI Runtime (LLM) | `llm.response` | Cache chat completions |
| RAG | `rag.retrieval`, `rag.knowledge` | Cache search results |
| Agents | `agent.output` | Cache agent responses |
| Multi-Agent | `workflow.result` | Cache workflow outputs |
| MCP | `mcp.tool` | Cache tool execution results |
| Queue | (via processors) | Processors can use semantic cache |
| Documents | `document.parse` | Cache parsed document text |
| Prompts | `prompt.result` | Cache rendered prompts |
| Conversation | `conversation.summary` | Cache generated summaries |
