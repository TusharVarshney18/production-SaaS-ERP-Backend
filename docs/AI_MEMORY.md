# AI Memory Architecture

## Overview

The Memory system provides agents with context across conversations. It has multiple layers with different retention policies and access scopes.

## Memory Layers

```
┌──────────────────────────────────────────────────────────────────┐
│                    MEMORY MANAGER                                │
│                                                                   │
│  Orchestrates which memory layers to read/write for each request  │
└──────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Session Memory  │  │  Long-term      │  │  Organization   │
│  (Redis / InMem) │  │  Memory (Pg)    │  │  Memory (Pg)    │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ TTL: 24 hours   │  │ Retention: 90d  │  │ Retention: ∞    │
│ Scope: Session  │  │ Scope: User     │  │ Scope: Org      │
│ Volatile: Yes   │  │ Volatile: No    │  │ Volatile: No    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                                                                   
         ┌────────────────────────────────────────────────────┐
         │              Memory Compactor                       │
         │  Background job: summarizes old session history     │
         │  into compact long-term memory entries.             │
         │  Runs daily via Workflow Engine cron.               │
         └────────────────────────────────────────────────────┘
```

## Session Memory

| Property | Value |
|---|---|
| Storage | PostgreSQL (`conversation_messages` table) OR Redis |
| TTL | 24 hours after last activity |
| Scope | Single conversation session |
| Content | Full message history (raw) |
| Access | Current conversation only |

**Schema** (if using PostgreSQL):

```typescript
// conversation_messages table
interface ConversationMessage {
  id: string;
  conversationId: string;
  organizationId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  tokenCount: number;
  createdAt: Date;
}
```

## Long-Term Memory

| Property | Value |
|---|---|
| Storage | PostgreSQL (`user_memory` table) |
| Retention | 90 days (configurable) |
| Scope | User-level (across all conversations) |
| Content | Summarized insights, preferences, facts |
| Access | Read on conversation start, write on conversation end |

**Schema**:

```typescript
// user_memory table
interface UserMemory {
  id: string;
  organizationId: string;
  userId: string;
  type: 'insight' | 'preference' | 'fact' | 'summary';
  content: string;            // Natural language summary
  confidence: number;         // 0.0 - 1.0
  source: string;             // What generated this memory
  sourceConversationId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

## Organization Memory

| Property | Value |
|---|---|
| Storage | PostgreSQL (`org_memory` table) |
| Retention | Infinite |
| Scope | Organization-wide |
| Content | Business policies, preferences, learned patterns |
| Access | All conversations in the org |

**Schema**:

```typescript
// org_memory table
interface OrgMemory {
  id: string;
  organizationId: string;
  type: 'policy' | 'preference' | 'pattern' | 'knowledge';
  key: string;                // Unique identifier
  content: string;            // The memory content
  source: string;             // How this was learned
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## Memory Interface

```typescript
interface IMemoryStore {
  readonly name: string;

  // Read
  get(key: string): Promise<MemoryEntry | null>;
  search(query: string, limit?: number): Promise<MemoryEntry[]>;
  getContext(context: MemoryContext): Promise<MemoryEntry[]>;

  // Write
  set(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<MemoryEntry>;
  delete(id: string): Promise<void>;

  // Maintenance
  compact(olderThan: Date): Promise<number>;  // Returns count of compacted entries
}

interface MemoryEntry {
  id: string;
  organizationId: string;
  userId?: string;
  conversationId?: string;
  type: MemoryType;
  content: string;
  metadata?: Record<string, unknown>;
  importance: number;        // 0-1: How important is this memory
  expiresAt?: Date;
  createdAt: Date;
}
```

## Memory Context Injection

When an agent starts processing a request, the `MemoryManager`:

1. Loads session memory (full conversation history)
2. Loads long-term memories (user facts, preferences)
3. Loads organization memories (policies, patterns)
4. Injects into the system prompt as context

```
System Prompt
    │
    ├── Agent Instructions
    ├── Available Tools
    │
    ├── [MEMORY: Session History]     ← Last N messages
    ├── [MEMORY: About the User]      ← Long-term facts
    └── [MEMORY: Organization]        ← Policies, patterns
```

## Memory Compaction Strategy

Old session histories are summarized by a background job:

```
Conversation (50 messages)
    │
    ▼
Memory Compactor (runs daily via Workflow)
    │
    ├──→ Split into segments of 10 messages
    ├──→ Call LLM to summarize each segment
    ├──→ Store summaries as long-term memories
    └──→ Mark session messages for archival (not deleted, just hidden)
```

## Retention Policy

| Memory Type | Retention | Action on Expiry |
|---|---|---|
| Session messages | 24 hours | Archived to long-term storage |
| User long-term | 90 days | Soft-deleted |
| Organization memory | Infinite | Never expires (admin-managed) |
| Conversation metadata | 1 year | Archived |
| Token usage logs | 3 years | Used for billing audit |

## Privacy Considerations

- Users can request: "Delete my conversation history"
- Organization admins can: clear org memory, export user data
- AI never stores raw passwords, secrets, or PII in memory
- Memory compaction uses data masking before summarization
