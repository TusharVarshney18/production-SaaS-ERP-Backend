# Cache Policies Architecture

## Overview

The CachePolicyManager provides per-category configuration for TTL, eviction strategy, and size limits.

## Policy Configuration

```typescript
interface CachePolicyConfig {
  maxSize: number;                 // Maximum entries in this category
  evictionStrategy: EvictionStrategy; // LRU | LFU | FIFO | TTL | priority
  defaultTtlMs: number;            // Default TTL in milliseconds
  maxTtlMs: number;                // Maximum allowed TTL
  slidingWindowMs?: number;        // Sliding expiration window
  enablePriorityRetention: boolean; // Keep high-priority entries
}
```

## Per-Category Defaults

| Category | Max Size | TTL | Eviction |
|----------|----------|-----|----------|
| `llm.response` | 500 | 5 min | LRU |
| `llm.embedding` | 2000 | 10 min | LRU |
| `rag.retrieval` | 1000 | 5 min | LRU |
| `rag.knowledge` | 500 | 10 min | LRU |
| `agent.output` | 300 | 5 min | LRU |
| `workflow.result` | 200 | 10 min | LRU |
| `mcp.tool` | 300 | 2 min | LRU |
| `document.parse` | 100 | 60 min | LRU |
| `prompt.result` | 200 | 5 min | LRU |
| `conversation.summary` | 100 | 10 min | LRU |

## Eviction Strategies

### LRU (Least Recently Used)
Evicts entries that haven't been accessed the longest.

```
candidates.sort(a.accessedAt - b.accessedAt)
→ returns first `count` entries
```

Best for: General-purpose caching with temporal locality.

### LFU (Least Frequently Used)
Evicts entries accessed the fewest times.

```
candidates.sort(a.accessCount - b.accessCount)
→ returns first `count` entries
```

Best for: Caching with skewed access patterns.

### FIFO (First In, First Out)
Evicts the oldest entries regardless of usage.

```
candidates.sort(a.createdAt - b.createdAt)
→ returns first `count` entries
```

Best for: Simple predictable workloads.

### TTL (Time-to-Live)
Evicts entries closest to expiration.

```
candidates.sort((now - b.createdAt) - (now - a.createdAt))
→ returns first `count` entries
```

Best for: Time-sensitive cached data.

### Priority
Evicts lowest-value entries first.

```
candidates.sort(a.accessCount - b.accessCount)
→ returns first `count` entries
```

Best for: When priority metadata is available.

## Eviction Flow

```
1. set() called
2. size = provider.getSize()
3. policy = policyManager.getPolicy(category)
4. if (size >= policy.maxSize):
     entries = provider.getAllEntries(orgId, category)
       .map(key, metadata)
     candidates = policyManager.selectEvictionCandidates(
       category, entries, Math.ceil(size * 0.2)
     )
     for key in candidates:
       provider.delete(key, orgId)
       metrics.recordEviction(category)
5. provider.set(key, value, orgId, category, { ttl: policy.defaultTtlMs })
```

## TTL Expiry

- **Fixed TTL**: Entry expires `ttl` ms after creation
- **Sliding TTL**: Entry expires `slidingTtl` ms after last access
- **Checked on get()**: If expired, entry is deleted and null returned
- **Periodic cleanup**: Expired entries are cleaned during getAllEntries()
