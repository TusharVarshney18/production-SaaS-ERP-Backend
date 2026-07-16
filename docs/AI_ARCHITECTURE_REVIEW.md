# AI Platform Architecture Review & Enhancement

## Executive Summary

This document reviews the existing AI Platform architecture across all 12 design documents and proposes enhancements in 10 key areas. The goal is to elevate from enterprise-grade to world-class — supporting thousands of organizations, millions of requests, multiple LLM providers, a plugin ecosystem, a marketplace, and future autonomous AI agents.

---

# Part 1: Architecture Review

## 1.1 Strengths of Current Architecture

| Area | Strength |
|---|---|
| Provider abstraction | Clean `IProvider` interface with factory pattern — 6 providers supported |
| Tools-only data access | AI never touches Prisma — critical security boundary |
| Organization isolation | Partitioned by `organizationId` at every layer |
| Prompt registry | YAML-based prompts outside TypeScript — independent versioning |
| Memory layering | 3-layer architecture covers session, long-term, and org memory |
| Security depth | 6-layer defense-in-depth design |
| Permission granularity | 30+ fine-grained `ai:*` permissions |
| Usage/cost tracking | Raw + aggregated tables with budget management |

## 1.2 Gaps & Risks Identified

| # | Gap | Risk | Severity |
|---|---|---|---|
| 1 | No MCP (Model Context Protocol) support | Vendor lock-in for tool definitions; incompatible with future MCP-native agents | High |
| 2 | Synchronous-only execution | Long-running AI tasks block requests; no retry mechanism | High |
| 3 | Simple agent routing (no multi-agent collaboration) | Cannot decompose complex tasks across agents; no conflict resolution | High |
| 4 | Hardcoded registrations in `onModuleInit()` | Every new agent/tool requires code change and deployment | Medium |
| 5 | No execution sandbox | Tools run without validation pipeline; error handling is per-tool | High |
| 6 | No semantic caching | Every repeated query hits LLM — high cost and latency | High |
| 7 | No AI-specific observability dashboards | Cannot monitor provider health, cache hit ratio, or failure patterns | Medium |
| 8 | No plugin architecture | Marketplace/third-party agents require core code changes | Medium |
| 9 | Basic frontend API design | No support for conversation folders, suggested prompts, tool timeline | Low |
| 10 | No vision/voice/autonomous agent design | Cannot evolve beyond text chat without architecture changes tomorrow | Low |

## 1.3 Duplication Analysis

| Duplication Found | Recommendation |
|---|---|
| Permission checks repeated across `AIPermissionGuard`, `ToolExecutor`, `AIPermissionService` | Consolidate into `AISandbox` — single permission validation point |
| Provider selection logic in both `ProviderRouter` and `AgentConfiguration` | Unify into `CapabilityRegistry` — single source of truth |
| Token counting in `UsageTracker` and `CostCalculator` | Merge into single `TokenCounter` service |
| Organization isolation logic scattered across memory, RAG, tools | Centralize in `Sandbox.Context` — single isolation boundary |

## 1.4 Scalability Risks

| Risk | Current | Required |
|---|---|---|
| Synchronous tool execution | Blocks LLM response | Async queue with progress tracking |
| No cache | 100% of queries hit LLM | Semantic cache for 40-60% hit rate |
| In-memory session memory | Loses context on restart | Redis-backed session store |
| No background workers | RAG indexing blocks requests | Queue-based background processing |
| Rate limiting at controller only | Misses tool-level throttling | Per-tool rate limits in sandbox |

## 1.5 Security Concerns

| Concern | Mitigation |
|---|---|
| Tool error messages may leak internals | Error sanitization in Sandbox |
| No prompt version pinning per agent | Add `pinnedPromptVersion` to agent config |
| No embedding provider auth | Add API key validation for embedding endpoints |
| Tool args logged in plain text | Mask sensitive args in audit logs |
| No cross-org cache isolation | Partition cache by organizationId |

---

# Part 2: Enhancements

## 2. MCP (Model Context Protocol) Architecture

### 2.1 Why MCP?

The Model Context Protocol (MCP) is an open standard from Anthropic for how AI applications communicate with tools and data sources. Adopting MCP makes ERPX AI tools compatible with any MCP-native agent, IDE, or client — and allows remote tools to be registered from anywhere.

### 2.2 MCP Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          MCP CLIENT                                  │
│  (Agent, AI Workspace, External IDE, Third-party agent)              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ MCP Protocol (JSON-RPC)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       MCP SERVER (src/ai/mcp/)                       │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    MCP Transport Layer                       │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │   │
│  │  │  HTTP     │  │  SSE      │  │  WebSocket│  │  StdIO   │ │   │
│  │  │  Transport│  │  Transport│  │  Transport│  │(local)   │ │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └──────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  MCP Protocol Handler                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │  tools/list  │  │  tools/call  │  │  resources/read  │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 MCP Tool Registry (Remote + Local)           │   │
│  │  ┌────────────────────┐  ┌──────────────────────────────┐   │   │
│  │  │  Local Tools       │  │  Remote Tool Proxies          │   │   │
│  │  │  (src/ai/tools/)   │  │  (third-party MCP servers)    │   │   │
│  │  └────────────────────┘  └──────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXISTING AI PLATFORM                              │
│  (Permission checks, Sandbox, Audit, Usage tracking unchanged)       │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 MCP Tool Registration

```typescript
// An MCP-compatible tool definition
interface MCPToolDefinition {
  name: string;                    // Tool name (snake_case)
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, MCPParameter>;
    required?: string[];
  };
}

interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
  meta?: Record<string, unknown>;
}

type MCPContent =
  | { type: 'text'; text: string }
  | { type: 'resource'; resource: { uri: string; text: string; mimeType?: string } }
  | { type: 'image'; data: string; mimeType: string };
```

### 2.4 Local vs Remote Tools

```typescript
// Local Tool — same process, direct execution
class LocalToolProxy implements IMCPTool {
  constructor(private readonly tool: ITool) {}

  async call(request: MCPToolCallRequest): Promise<MCPToolResult> {
    const result = await this.tool.execute(request.params.input, {
      organizationId: request.meta?.organizationId,
      userId: request.meta?.userId,
      agentName: request.meta?.agentName,
      requestId: request.meta?.requestId,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result.data) }] };
  }
}

// Remote Tool — connects to external MCP server
class RemoteToolProxy implements IMCPTool {
  constructor(
    private readonly serverUrl: string,
    private readonly serverName: string,
  ) {}

  async call(request: MCPToolCallRequest): Promise<MCPToolResult> {
    // Forward via MCP protocol to remote server
    const response = await fetch(`${this.serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: request.name, arguments: request.params.input },
      }),
    });
    return response.json();
  }
}
```

### 2.5 Tool Discovery

```
MCP Server exposes tools via:
GET  /mcp/tools         → List all tools (for discovery)
POST /mcp/tools/call    → Execute a tool
POST /mcp/resources/read → Access data resources

Remote MCP servers (third-party) are registered in configuration:
yaml
mcpServers:
  stripe:
    url: https://mcp.stripe.com/mcp
    transport: http
  slack:
    url: https://mcp.slack.com/mcp
    transport: http
```

---

## 3. AI Task Queue

### 3.1 Async Architecture

```
┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│  AI Request  │────→│  AI Task Queue │────→│   Workers    │
│  (sync)      │     │  (Bull/BullMQ) │     │  (separate   │
└──────────────┘     └────────────────┘     │   process)   │
       │                                     └──────────────┘
       │                                            │
       ▼                                            ▼
┌──────────────┐                          ┌──────────────────┐
│  Immediate   │                          │  Progress        │
│  Response    │                          │  Tracking (Redis)│
│  (taskId)    │                          └──────────────────┘
└──────────────┘                                   │
                                                   ▼
                                          ┌──────────────────┐
                                          │  Result Store    │
                                          │  (PostgreSQL)    │
                                          └──────────────────┘
```

### 3.2 Queue Architecture

```typescript
// Task Queue uses existing Bull/BullMQ (or similar)
// Queues are defined per workload type:

const QUEUES = {
  ai_chat: {
    name: 'ai:chat',
    concurrency: 50,
    retries: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
  ai_embedding: {
    name: 'ai:embedding',
    concurrency: 10,
    retries: 2,
  },
  ai_rag_index: {
    name: 'ai:rag:index',
    concurrency: 5,
    retries: 3,
  },
  ai_document_analysis: {
    name: 'ai:document:analysis',
    concurrency: 3,
    retries: 2,
  },
  ai_report_generation: {
    name: 'ai:report:generation',
    concurrency: 5,
    retries: 2,
    timeout: 300000, // 5 min
  },
  ai_summarization: {
    name: 'ai:summarization',
    concurrency: 20,
    retries: 3,
  },
  ai_memory_compaction: {
    name: 'ai:memory:compaction',
    concurrency: 2,
    retries: 1,
    repeat: { cron: '0 2 * * *' }, // Daily at 2 AM
  },
};
```

### 3.3 Task Lifecycle

```
ENQUEUED ──→ PROCESSING ──→ COMPLETED
    │              │              │
    │              ├──→ FAILED ───┤
    │              │      │       │
    │              │      ├──→ RETRY (if retries remain)
    │              │      └──→ DEAD_LETTER (if exhausted)
    │              │
    │              └──→ CANCELLED (by user/admin)
    │
    └──→ DEAD_LETTER (if TTL exceeded before processing)
```

### 3.4 Progress Tracking

```typescript
interface TaskProgress {
  taskId: string;
  status: TaskStatus;
  progress: number;            // 0-100
  stage: string;               // 'indexing' | 'analyzing' | 'generating'
  message: string;             // "Indexing 45 of 120 documents..."
  result?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletionAt?: Date;
}

// Progress is stored in Redis (fast reads) and persists to PostgreSQL on completion.
// Frontend polls: GET /ai/tasks/:taskId/progress
```

### 3.5 Queue Integration with Existing Architecture

```
Workflow Engine
    │
    ├──→ AI_HOOK Action
    │       │
    │       ├──→ If quick (< 5s): synchronous execution
    │       └──→ If slow: enqueue task → return taskId
    │               │
    │               ├──→ Notify via WebSocket on completion
    │               └──→ Store result in PostgreSQL
    │
    └──→ Frontend polls or receives WebSocket notification
```

---

## 4. Multi-Agent Collaboration

### 4.1 Agent Orchestrator

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AGENT ORCHESTRATOR                              │
│                                                                      │
│  Receives complex user request                                       │
│                                                                      │
│  1. Task Decomposition                                               │
│     "Analyze Q3 sales, check inventory, and suggest reorder"         │
│     ↓                                                                │
│     ├── Subtask 1: Sales Agent → Get Q3 sales data                   │
│     ├── Subtask 2: Inventory Agent → Get stock levels                 │
│     └── Subtask 3: CEO Agent → Synthesize and recommend              │
│                                                                      │
│  2. Parallel Execution                                               │
│     ┌──────────────────────────────────────────────────────────┐    │
│     │  Subtask 1 (Sales)  ────→ Result 1                       │    │
│     │  Subtask 2 (Inv.)    ────→ Result 2        (parallel)    │    │
│     └──────────────────────────────────────────────────────────┘    │
│                                                                      │
│  3. Result Aggregation                                              │
│     Combined context = Result 1 + Result 2 + Original Query          │
│                                                                      │
│  4. Final Synthesis (CEO Agent or Orchestrator)                     │
│     Input: Combined context → Output: Final response                 │
│                                                                      │
│  5. Conflict Resolution                                              │
│     If agents disagree → Orchestrator flags discrepancy              │
│     → Re-query with clarification → Use majority vote               │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Task Decomposition

```typescript
interface DecomposedTask {
  id: string;
  agentName: string;
  query: string;
  context: {
    parentTaskId?: string;
    dependencies: string[];    // Tasks that must complete first
    requiredData: string[];    // Data needed from other tasks
  };
  priority: number;
  timeout: number;             // ms
}

// Decomposition Strategy
class TaskDecomposer {
  async decompose(request: string): Promise<DecomposedTask[]> {
    // 1. Call LLM to analyze the request
    // 2. LLM returns a decomposition plan (JSON)
    // 3. Validates plan against available agents
    // 4. Builds dependency graph
    // 5. Returns ordered task list

    const plan = await this.llm.complete(`
      Analyze this user request: "${request}"
      Break it down into subtasks that can be executed by specialized agents.
      Available agents: CEO, Finance, Sales, Inventory, Procurement, HR.
      Return JSON: { tasks: [{ agent, query, dependencies: [] }] }
    `);
    return this.buildDependencyGraph(plan);
  }
}
```

### 4.3 Agent-to-Agent Communication

```typescript
interface AgentMessage {
  from: string;
  to: string;
  type: 'query' | 'response' | 'request_clarification' | 'error';
  threadId: string;
  payload: {
    query?: string;
    data?: unknown;
    error?: string;
    confidence: number;        // 0-1
  };
  timestamp: Date;
}

// Agents communicate through the AgentOrchestrator (not directly).
// This ensures:
// - All communication is logged
// - Permissions are checked on every exchange
// - Conflicts can be identified and resolved
// - The orchestrator can interject if needed
```

### 4.4 Conflict Resolution

```
Scenario: Sales Agent says "revenue is up 15%", Finance Agent says "revenue is up 12%"

    │
    ▼
Orchestrator detects discrepancy (> 2% difference)
    │
    ├──→ Check data sources
    ├──→ Sales Agent used: invoice.createdAt
    ├──→ Finance Agent used: payment.capturedAt
    │
    ├──→ Determine correct answer: difference is timing
    ├──→ Response: "Revenue is up 12-15% depending on measurement method..."
    │
    └──→ Log discrepancy for system improvement
```

### 4.5 Dependency Graph

```
Task A (Sales Agent): "Get Q3 revenue"
    │
    ├── no dependencies
    ▼
[complete] → Result: Q3 revenue = $1.2M

Task B (Inventory Agent): "Get stock levels for top 10 products"
    │
    ├── no dependencies
    ▼
[complete] → Result: 3 products below reorder level

Task C (Procurement Agent): "Get vendor lead times"
    │
    ├── depends on: Task B (needs product list)
    ▼
[waiting for B] → [complete] → Result: avg lead time 14 days

Task D (CEO Agent): "Synthesize and recommend"
    │
    ├── depends on: Task A, Task B, Task C
    ▼
[waiting for A, B, C] → [all complete] → Final response
```

---

## 5. AI Capability Registry

### 5.1 Metadata-Driven Architecture

Replace `onModuleInit()` hardcoded registrations with a metadata-driven registry:

```yaml
# config/ai.capabilities.yaml
capabilities:
  - name: finance-analysis
    type: agent
    displayName: Finance Agent
    description: Financial analysis and accounting insights
    provider: claude/claude-sonnet-4
    prompt: finance-agent-system-prompt-v1
    temperature: 0.1
    maxTokens: 4096
    memory: long-term
    permissions:
      - ai:agent:finance
      - ai:tool:accounting:read
      - ai:tool:payment:read
      - ai:tool:reporting:read
      - ai:tool:workflow:read
    tools:
      - accounting
      - payment
      - reporting
      - workflow
    models:
      preferred: claude-sonnet-4
      fallback: gpt-4o
    rateLimit:
      requestsPerMinute: 20
      tokensPerMinute: 50000
    enabled: true

  - name: inventory-lookup
    type: tool
    displayName: Inventory Tool
    description: Access inventory stock levels and movements
    modules: [inventory]
    operations:
      - name: getStock
        readOnly: true
        permission: ai:tool:inventory:read
      - name: adjustStock
        readOnly: false
        permission: ai:tool:inventory:write
        requiresConfirmation: true

  - name: openai-gpt4o
    type: provider
    displayName: OpenAI GPT-4o
    models:
      - name: gpt-4o
        maxTokens: 16384
        costPer1kInput: 0.25
        costPer1kOutput: 1.0
    capabilities:
      - toolCalling: true
      - streaming: true
      - vision: true
      - jsonMode: true
```

### 5.2 Capability Registry Service

```typescript
@Injectable()
export class CapabilityRegistryService {
  private capabilities: Map<string, CapabilityDefinition> = new Map();

  async onModuleInit() {
    await this.loadFromYaml('config/ai.capabilities.yaml');
    await this.loadFromDatabase(); // Org-specific overrides
    await this.loadFromPlugins();  // Plugin-provided capabilities
  }

  getAgent(name: string): AgentDefinition | undefined { /* ... */ }
  getTool(name: string): ToolDefinition | undefined { /* ... */ }
  getProvider(name: string): ProviderDefinition | undefined { /* ... */ }
  getAgentsForOrg(orgId: string): AgentDefinition[] { /* filter by org permissions */ }
  getToolsForAgent(agentName: string): ToolDefinition[] { /* ... */ }

  registerPluginCapabilities(plugin: PluginPackage): void {
    for (const cap of plugin.manifest.capabilities) {
      this.capabilities.set(cap.name, cap);
    }
  }
}
```

### 5.3 Benefits

| Benefit | Before | After |
|---|---|---|
| Adding an agent | Code + deploy | YAML config change |
| Adding a tool | Code + deploy | YAML config change |
| Per-org agent config | Not supported | Database overrides |
| Custom temperature per agent | Hardcoded | Metadata-driven |
| Tool permission per role | Code | Declarative YAML |

---

## 6. AI Sandbox

### 6.1 Sandbox Architecture

Every tool execution passes through the Sandbox — a single unified execution pipeline:

```
                 ┌─────────────────────────────────────────┐
                 │              AI SANDBOX                  │
                 │                                         │
  Tool Request   │  ┌───────────────────────────────────┐  │
  ──────────────→│  │  1. Validate Input Schema         │  │
                 │  │     - Type check all parameters   │  │
                 │  │     - Reject unknown parameters   │  │
                 │  └───────────────────────────────────┘  │
                 │  ┌───────────────────────────────────┐  │
                 │  │  2. Sanitize Input                │  │
                 │  │     - Strip HTML/script tags      │  │
                 │  │     - Detect injection patterns   │  │
                 │  │     - Mask sensitive data in args │  │
                 │  └───────────────────────────────────┘  │
                 │  ┌───────────────────────────────────┐  │
                 │  │  3. Permission Check              │  │
                 │  │     - User has tool permission?   │  │
                 │  │     - Agent has tool permission?  │  │
                 │  │     - Org isolation verified?     │  │
                 │  └───────────────────────────────────┘  │
                 │  ┌───────────────────────────────────┐  │
                 │  │  4. Rate Limit Check              │  │
                 │  │     - Per-user rate limit         │  │
                 │  │     - Per-org rate limit          │  │
                 │  │     - Per-tool rate limit         │  │
                 │  └───────────────────────────────────┘  │
                 │  ┌───────────────────────────────────┐  │
                 │  │  5. Execute (with timeout)        │  │
                 │  │     - Run within timeout window   │  │
                 │  │     - Catch and classify errors   │  │
                 │  └───────────────────────────────────┘  │
                 │  ┌───────────────────────────────────┐  │
                 │  │  6. Audit & Track                 │  │
                 │  │     - Log execution               │  │
                 │  │     - Track tokens/cost           │  │
                 │  │     - Update rate limit counters  │  │
                 │  └───────────────────────────────────┘  │
                 └─────────────────────────────────────────┘
```

### 6.2 Sandbox Interface

```typescript
interface SandboxContext {
  organizationId: string;
  userId: string;
  userRoles: string[];
  agentName: string;
  requestId: string;
  correlationId: string;
  ipAddress: string;
}

interface SandboxResult {
  success: boolean;
  data: unknown;
  error?: SandboxError;
  executionTime: number;       // ms
  auditId: string;
  masked: boolean;             // Was data masked in response?
}

interface SandboxError {
  code: 'VALIDATION' | 'PERMISSION' | 'RATE_LIMIT' | 'TIMEOUT' | 'INTERNAL' | 'INJECTION';
  message: string;
  details?: Record<string, unknown>;
  userMessage: string;         // Safe to show to end user
}
```

### 6.3 Mutation Confirmation in Sandbox

```typescript
// For write operations, the sandbox requires explicit confirmation
class SandboxService {
  async execute(
    tool: ITool,
    args: Record<string, unknown>,
    context: SandboxContext,
    confirmed: boolean,
  ): Promise<SandboxResult> {
    // Step 1-4: Validate, sanitize, permission, rate limit
    await this.preFlightChecks(tool, args, context);

    // Step 5: Mutation check
    if (tool.requiresConfirmation && !confirmed) {
      return {
        success: false,
        data: null,
        error: {
          code: 'PERMISSION',
          message: 'Mutation requires user confirmation',
          userMessage: `I need your confirmation to proceed with: ${this.describeMutation(tool, args)}`,
        },
      };
    }

    // Step 6: Execute
    return this.executeWithTimeout(tool, args, context);
  }
}
```

---

## 7. Semantic Cache

### 7.1 Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  User Query  │────→│  Semantic       │────→│  LLM Provider│
│              │     │  Cache          │     │              │
└──────────────┘     └─────────────────┘     └──────────────┘
                           │
                           ▼
                     ┌──────────────────┐
                     │  Cache Lookup    │
                     │                  │
                     │  1. Embed query  │
                     │  2. Cosine sim   │
                     │     with cache   │
                     │  3. Threshold >  │
                     │     0.95 → hit   │
                     └──────────────────┘
                           │
                    Hit ───┴─── Miss
                           │
                           ▼
                     ┌──────────────────┐
                     │  Store Response  │
                     │  → Embed query   │
                     │  → Store in vec  │
                     └──────────────────┘
```

### 7.2 Cache Layers

```typescript
interface SemanticCacheConfig {
  // Layer 1: Exact match cache (Redis)
  exactMatchTTL: number;            // 1 hour

  // Layer 2: Semantic cache (pgvector)
  semanticSimilarityThreshold: number; // 0.95 for exact, 0.85 for near
  semanticTTL: number;              // 24 hours
  maxEntriesPerOrg: number;         // 10000

  // Layer 3: Conversation cache (in-memory for active conversations)
  conversationTTL: number;          // Session duration

  // Layer 4: Organization cache (common queries cached per org)
  orgCacheTTL: number;              // 7 days
}

class SemanticCacheService {
  async get(query: string, context: CacheContext): Promise<CacheResult | null> {
    // 1. Check exact match (Redis)
    const exact = await this.exactCache.get(this.buildKey(query, context));
    if (exact) return exact;

    // 2. Check semantic similarity (pgvector)
    const queryEmbedding = await this.embedder.embed(query);
    const similar = await this.semanticCache.search(
      queryEmbedding,
      context.organizationId,
      context.agentName,
      this.config.semanticSimilarityThreshold,
    );
    if (similar.length > 0) return similar[0];

    // 3. Miss — return null
    return null;
  }

  async set(query: string, response: string, context: CacheContext): Promise<void> {
    const embedding = await this.embedder.embed(query);
    await Promise.all([
      this.exactCache.set(this.buildKey(query, context), response, this.config.exactMatchTTL),
      this.semanticCache.store(embedding, query, response, context),
    ]);
  }
}
```

### 7.3 Invalidation Strategies

| Strategy | Trigger | Scope |
|---|---|---|
| TTL expiry | Time-based | Per entry |
| Organization data change | `StockAdjusted` event | Clear org's inventory cache |
| Manual invalidation | Admin action | Agent-specific |
| Version change | Prompt version updated | Clear affected cache |
| Provider change | Provider/model changed | Clear all |

### 7.4 Cache Partitioning

```
Cache Key Structure:
  {orgId}:{agentName}:{promptVersion}:{embeddingHash}

This ensures:
- Cross-org isolation (orgA can't see orgB's cached responses)
- Agent-specific caching (Sales Agent gets different results than Finance)
- Prompt version isolation (v1 → v2 doesn't serve stale cache)
```

### 7.5 Expected Impact

| Metric | Without Cache | With Semantic Cache |
|---|---|---|
| Average latency | 2-5s | 0.1-0.5s (hit) |
| Cost per query | $0.003-0.03 | $0.0001 (hit) |
| Provider load | 100% of queries | 40-60% of queries |
| Cache hit rate | 0% | 40-60% |

---

## 8. AI Observability

### 8.1 Metrics Collection

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  AI Platform │────→│  Metrics        │────→│  Prometheus  │
│  (every      │     │  Collector      │     │              │
│   operation) │     │  (src/ai/obs/)  │     └──────────────┘
└──────────────┘     └─────────────────┘            │
                           │                        ▼
                           │                 ┌──────────────┐
                           │                 │  Grafana     │
                           │                 │  Dashboards  │
                           │                 └──────────────┘
                           ▼
                     ┌─────────────────┐
                     │  Elasticsearch  │
                     │  (log storage)  │
                     └─────────────────┘
```

### 8.2 Key Metrics

```typescript
// Latency Metrics
ai_chat_latency_seconds{provider,model,agent}        // Histogram
ai_chat_ttft_seconds{provider,model}                  // Time to first token
ai_tool_execution_seconds{tool,operation}              // Per-tool latency

// Error Metrics
ai_errors_total{provider,model,agent,error_type}      // Counter
ai_tool_errors_total{tool,operation,error_code}        // Counter

// Throughput Metrics
ai_requests_total{provider,model,agent}                // Counter
ai_tokens_total{provider,model,type}                   // Counter (input vs output)
ai_concurrent_requests{agent}                          // Gauge

// Cache Metrics
ai_cache_hits_total{cache_layer}                       // Counter
ai_cache_misses_total{cache_layer}                     // Counter
ai_cache_hit_ratio                                     // Gauge (0-1)

// Cost Metrics
ai_cost_total{provider,model,org}                      // Counter (cents)
ai_monthly_org_cost{org}                               // Gauge

// Provider Health
ai_provider_health{provider}                           // Gauge (0/1)
ai_provider_fallback_total{from_provider,to_provider}  // Counter

// Business Metrics
ai_active_users_total{org}                             // Gauge
ai_conversations_total{org,agent}                      // Counter
ai_tool_calls_total{tool,operation}                    // Counter
```

### 8.3 Alerting Rules

```yaml
alerts:
  - name: HighErrorRate
    condition: rate(ai_errors_total[5m]) > 0.05
    severity: critical
    message: "AI error rate > 5% over 5 minutes"

  - name: HighLatency
    condition: p99(ai_chat_latency_seconds) > 10
    severity: warning
    message: "P99 latency > 10s"

  - name: ProviderDown
    condition: ai_provider_health{provider="openai"} == 0
    severity: critical
    message: "OpenAI provider is down, check fallback"

  - name: CacheHitRatioDropped
    condition: ai_cache_hit_ratio < 0.2
    severity: warning
    message: "Cache hit ratio dropped below 20%"

  - name: BudgetExceeded
    condition: ai_monthly_org_cost{org="org_abc"} > 100000
    severity: warning
    message: "Organization org_abc exceeded $1000 monthly AI budget"

  - name: FallbackActive
    condition: rate(ai_provider_fallback_total[10m]) > 10
    severity: warning
    message: "Multiple provider fallbacks occurring — primary provider unstable"
```

### 8.4 Observability Service

```typescript
@Injectable()
export class AIObservabilityService {
  constructor(
    private readonly metrics: MetricsCollector,
    private readonly logger: Logger,
    private readonly tracer: Tracer,  // OpenTelemetry
  ) {}

  recordChatCompletion(metrics: ChatMetrics): void {
    this.metrics.histogram('ai_chat_latency_seconds', metrics.latency, {
      provider: metrics.provider,
      model: metrics.model,
      agent: metrics.agent,
    });
    this.metrics.counter('ai_tokens_total', metrics.totalTokens, {
      type: 'total',
    });
    this.metrics.counter('ai_requests_total', 1, {
      provider: metrics.provider,
      model: metrics.model,
      agent: metrics.agent,
    });
  }

  createTrace(name: string): Span {
    return this.tracer.startSpan(name, {
      attributes: { platform: 'ai', version: '1.0' },
    });
  }

  logError(context: ErrorContext): void {
    this.metrics.counter('ai_errors_total', 1, {
      error_type: context.errorType,
      provider: context.provider,
      agent: context.agent,
    });
    this.logger.error({
      message: context.message,
      requestId: context.requestId,
      provider: context.provider,
      model: context.model,
      agent: context.agent,
      error: context.error,
    });
  }
}
```

---

## 9. Plugin Architecture

### 9.1 Plugin Lifecycle

```
DISCOVERED ──→ INSTALLED ──→ ENABLED ──→ RUNNING ──→ DISABLED ──→ UNINSTALLED
    │              │            │           │
    │              │            │           └──→ Error → DISABLED
    │              │            │
    │              │            └──→ Dependency check fail → DISABLED
    │              │
    │              └──→ Validation fail → UNINSTALLED
    │
    └──→ Scan plugins directory
          Read plugin manifest
          Validate checksum
```

### 9.2 Plugin Package Structure

```
plugin-ai-vendor-analytics-v1.0.0.zip
├── manifest.yaml              # Required — plugin metadata
├── agents/
│   └── vendor-analytics.agent.yaml  # Agent definition
├── tools/
│   └── vendor-analytics.tool.yaml   # Tool definition
├── prompts/
│   └── vendor-analytics-prompt-v1.yaml
├── workflows/
│   └── vendor-analytics.workflow.yaml
├── assets/
│   └── icon.svg
└── README.md
```

### 9.3 Plugin Manifest

```yaml
# manifest.yaml
name: vendor-analytics
version: 1.0.0
type: ai-plugin
displayName: Vendor Analytics AI
description: Advanced vendor performance analytics powered by AI
author: ERPX Marketplace
license: MIT

capabilities:
  - name: vendor-analytics
    type: agent
    displayName: Vendor Analytics Agent
    description: Analyzes vendor performance and suggests optimizations
    provider: openai/gpt-4o-mini
    prompt: vendor-analytics-prompt-v1
    tools:
      - procurement
      - reporting
    permissions:
      - ai:tool:procurement:read
      - ai:tool:reporting:read
    rateLimit:
      requestsPerMinute: 10

  - name: vendor-risk-score
    type: tool
    displayName: Vendor Risk Score
    description: Calculates vendor risk based on delivery history
    operations:
      - name: getRiskScore
        readOnly: true
        permission: ai:tool:procurement:read

dependencies:
  plugins: []
  erpxVersion: ">=12.0.0"

hooks:
  onInstall: []
  onUninstall: []
```

### 9.4 Plugin Manager Service

```typescript
@Injectable()
export class PluginManagerService {
  private readonly pluginsDir = path.join(process.cwd(), 'plugins');

  async discover(): Promise<PluginPackage[]> {
    const dirs = await fs.readdir(this.pluginsDir);
    const plugins: PluginPackage[] = [];

    for (const dir of dirs) {
      if (dir.endsWith('.zip')) {
        const plugin = await this.extractAndValidate(dir);
        if (plugin) plugins.push(plugin);
      }
    }
    return plugins;
  }

  async install(zipPath: string): Promise<void> {
    // 1. Extract ZIP to plugins/{name}/
    // 2. Validate manifest.yaml
    // 3. Check dependencies
    // 4. Register capabilities in CapabilityRegistry
    // 5. Register workflows in WorkflowEngine
    // 6. Store installation record
    // 7. Log audit
  }

  async uninstall(name: string): Promise<void> {
    // 1. Disable plugin
    // 2. Remove capabilities from registry
    // 3. Remove workflows
    // 4. Remove files
    // 5. Log audit
  }
}
```

### 9.5 Marketplace Integration (Future)

```
Marketplace (future web app)
    │
    ├──→ Browse available plugins
    ├──→ Purchase/Install
    │
    ▼
Marketplace API (external)
    │
    ├──→ Validate license
    ├──→ Generate signed plugin package
    │
    ▼
ERPX Admin installs via:
    ├──→ Admin UI (drag-and-drop upload)
    └──→ CLI: npm run plugin:install vendor-analytics-1.0.0.zip
```

---

## 10. Frontend Preparation

### 10.1 AI Workspace API Design

```typescript
// ─── Conversations ──────────────────────────────

// POST /ai/organizations/:orgId/conversations
interface CreateConversationRequest {
  title: string;
  agentName: string;        // 'ceo' | 'finance' | etc.
  folderId?: string;
  context?: {
    module?: string;         // 'inventory' | 'sales' | etc.
    resourceId?: string;    // Pre-selected resource
  };
}
interface CreateConversationResponse {
  id: string;
  title: string;
  agentName: string;
  createdAt: Date;
}

// GET /ai/organizations/:orgId/conversations
interface ListConversationsRequest {
  folderId?: string;
  agentName?: string;
  search?: string;
  page: number;
  limit: number;
}
interface ListConversationsResponse {
  conversations: ConversationSummary[];
  folders: ConversationFolder[];
  meta: PaginationMeta;
}

// DELETE /ai/organizations/:orgId/conversations/:id
// PATCH /ai/organizations/:orgId/conversations/:id
interface UpdateConversationRequest {
  title?: string;
  folderId?: string;
  archived?: boolean;
}

// ─── Folders ────────────────────────────────────

// POST /ai/organizations/:orgId/conversations/folders
interface CreateFolderRequest {
  name: string;
  parentId?: string;
}

// ─── Messages / Chat (Streaming) ────────────────

// POST /ai/organizations/:orgId/conversations/:id/messages
// Response: SSE Stream
interface ChatRequest {
  message: string;
  agentName: string;        // Can switch agents mid-conversation
  stream: boolean;          // Always true for v1
  context?: {
    module?: string;
    resourceId?: string;
    mode?: 'chat' | 'analyze' | 'suggest' | 'generate';
  };
}

// SSE Event Stream:
// event: token
// data: {"token": "The", "index": 0}
//
// event: token
// data: {"token": " revenue", "index": 1}
//
// event: tool_call
// data: {"tool": "inventory", "operation": "getStock", "status": "executing"}
//
// event: tool_result
// data: {"tool": "inventory", "operation": "getStock", "result": {...}}
//
// event: complete
// data: {"messageId": "msg-123", "usage": {...}, "suggestedActions": [...]}
//
// event: error
// data: {"code": "RATE_LIMIT", "message": "Too many requests"}

// ─── Suggested Actions ──────────────────────────

// GET /ai/organizations/:orgId/suggested-actions?module=sales
interface SuggestedActionsResponse {
  actions: {
    id: string;
    label: string;
    description: string;
    query: string;           // Pre-filled prompt
    agentName: string;
    icon: string;
  }[];
}

// ─── Context Panel ──────────────────────────────

// GET /ai/organizations/:orgId/context/:conversationId
interface ContextPanelResponse {
  currentAgent: { name: string; displayName: string };
  tools: { name: string; description: string; calls: number }[];
  memory: { type: string; content: string }[];
  sources: { title: string; relevance: number }[];
  suggestedFollowUps: string[];
}

// ─── Activity History ───────────────────────────

// GET /ai/organizations/:orgId/activity?days=7
interface ActivityHistoryResponse {
  activities: {
    id: string;
    type: 'chat' | 'tool_execution' | 'rag_query' | 'error';
    agentName: string;
    summary: string;
    duration: number;
    timestamp: Date;
    conversationId: string;
  }[];
}

// ─── Knowledge Search ───────────────────────────

// GET /ai/organizations/:orgId/knowledge/search?q=return+policy
interface KnowledgeSearchResponse {
  results: {
    id: string;
    title: string;
    excerpt: string;
    relevance: number;
    source: string;
    sourceUrl?: string;
  }[];
  total: number;
}
```

### 10.2 SSE Streaming Service

```typescript
@Injectable()
export class SSEStreamService {
  async streamResponse(
    response: AsyncIterable<ChatResponse>,
    res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');  // For nginx

    let index = 0;
    for await (const chunk of response) {
      if (chunk.type === 'token') {
        res.write(`event: token\ndata: ${JSON.stringify({ token: chunk.text, index })}\n\n`);
        index++;
      } else if (chunk.type === 'tool_call') {
        res.write(`event: tool_call\ndata: ${JSON.stringify(chunk.data)}\n\n`);
      } else if (chunk.type === 'error') {
        res.write(`event: error\ndata: ${JSON.stringify(chunk.data)}\n\n`);
      }
    }
    res.write(`event: complete\ndata: ${JSON.stringify(chunk.data)}\n\n`);
    res.end();
  }
}
```

### 10.3 Streaming Sequence

```
Client                     Server                    LLM
  │                         │                         │
  │── POST /chat (message)──│                         │
  │                         │── POST /v1/chat (stream)│
  │                         │                         │
  │← event: token ("The")──│← token                   │
  │← event: token ("revenue") │← token                │
  │← event: token (" is")──│← token                   │
  │                         │                         │
  │← event: tool_call──────│← tool_use                │
  │                         │────────────────────      │
  │                         │ Execute Tool             │
  │                         │────────────────────      │
  │← event: tool_result────│← result                  │
  │                         │                         │
  │← event: token ("Based")│← token (continued)       │
  │← event: token (" on")──│← token                   │
  │                         │                         │
  │← event: complete───────│← complete                │
  │                         │                         │
```

---

## 11. Future Vision

### 11.1 Multi-Modal Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MULTI-MODAL AI PLATFORM                           │
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │  Text      │  │  Voice     │  │  Image     │  │  Document    │  │
│  │  (Chat)    │  │  (STT/TTS) │  │  (Vision)  │  │  (OCR)      │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────────┘  │
│         │              │              │               │             │
│         ▼              ▼              ▼               ▼             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    MODALITY ROUTER                            │  │
│  │  Routes to correct provider based on input type              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│         │                                                          │
│         ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    EXISTING AI PLATFORM                       │  │
│  │  (Providers, Agents, Tools, Memory, RAG, Security)           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.2 Channel Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CHANNEL INTEGRATION LAYER                         │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐  │
│  │  Web     │  │  Email   │  │  Slack   │  │  Teams   │  │Whats │  │
│  │  (chat)  │  │          │  │          │  │          │  │ App  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────┘  │
│         │           │             │             │           │       │
│         ▼           ▼             ▼             ▼           ▼       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    CHANNEL ADAPTER                            │  │
│  │  Normalizes all channel inputs → AI Platform requests         │  │
│  │  Converts AI Platform responses → Channel-specific formats    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│         │                                                          │
│         ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    AI PLATFORM CORE                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
```

### 11.3 Autonomous Agents

```typescript
interface AutonomousAgentConfig {
  name: string;
  schedule: string;              // Cron expression
  goal: string;                  // High-level objective
  tools: string[];               // Allowed tools
  maxSteps: number;              // Max actions per run
  maxDuration: number;           // Max run time (ms)
  approvalMode: 'none' | 'read_only' | 'confirm_each' | 'summary';
  context: {
    organizationId: string;
    userId: string;              // System user
  };
}

// Examples:
const AUTO_AGENTS = {
  dailyInventoryReport: {
    name: 'daily-inventory-report',
    schedule: '0 7 * * *',       // Every day at 7 AM
    goal: 'Generate and email inventory report to warehouse manager',
    tools: ['inventory', 'reporting', 'workflow'],
    maxSteps: 10,
    approvalMode: 'read_only',
  },

  anomalyDetection: {
    name: 'anomaly-detection',
    schedule: '0 */4 * * *',     // Every 4 hours
    goal: 'Check for unusual patterns in sales, inventory, and accounting',
    tools: ['sales', 'inventory', 'accounting', 'workflow'],
    maxSteps: 20,
    approvalMode: 'summary',      // Send summary, no confirmation needed
  },

  vendorNegotiationSuggestions: {
    name: 'vendor-negotiation',
    schedule: '0 8 * * 1',       // Every Monday at 8 AM
    goal: 'Analyze vendor performance and suggest renegotiation targets',
    tools: ['procurement', 'reporting', 'workflow'],
    maxSteps: 15,
    approvalMode: 'confirm_each', // Must confirm each suggestion
  },
};
```

### 11.4 Background AI Workers

```
┌─────────────────────────────────────────────────────────────────────┐
│                   BACKGROUND AI WORKERS                              │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │  Report Generator   │  │  Document Analyzer  │                   │
│  │  - Daily sales      │  │  - Uploaded docs    │                   │
│  │  - Weekly metrics   │  │  - Email parsing    │                   │
│  │  - Monthly reviews  │  │  - Policy extraction │                   │
│  └─────────────────────┘  └─────────────────────┘                   │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │  Memory Compactor   │  │  RAG Indexer        │                   │
│  │  - Summarize        │  │  - Chunk documents  │                   │
│  │  - Prune old        │  │  - Generate vectors │                   │
│  │  - Extract insights │  │  - Store in pgvector│                   │
│  └─────────────────────┘  └─────────────────────┘                   │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │  Anomaly Detector   │  │  Data Enricher      │                   │
│  │  - Statistical      │  │  - Auto-categorize  │                   │
│  │  - LLM-based        │  │  - Extract entities │                   │
│  │  - Alert generation │  │  - Suggest tags     │                   │
│  └─────────────────────┘  └─────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.5 Architecture Evolution Roadmap

```
Phase 1 (Current)     Phase 2 (+2 months)    Phase 3 (+6 months)    Phase 4 (+12 months)
─────────────────     ──────────────────     ──────────────────     ───────────────────
Provider layer         MCP Protocol            Voice AI                Autonomous Agents
Basic agents           Task Queue              Image understanding     Channel integration
Tool architecture      Multi-agent             Document OCR           AI Marketplace
Prompt registry        Semantic Cache          Email AI                Custom agent builder
Memory (3-layer)       AI Sandbox              Slack/Teams AI          Multi-modal support
RAG engine             Capability Registry     Scheduled AI jobs       Self-learning agents
Usage/cost tracking    Observability           Plugin architecture     AI-to-AI collaboration
Security & audit       AI Workspace APIs       Background workers      Predictive AI
```

---

## Summary of Recommendations

| # | Enhancement | Priority | Effort | Impact |
|---|---|---|---|---|
| 1 | MCP Protocol adoption | High | Medium | Enables remote tools, third-party integration |
| 2 | AI Task Queue | High | Medium | Async processing, retries, background jobs |
| 3 | Multi-Agent Collaboration | High | Large | Complex task decomposition |
| 4 | Capability Registry | High | Medium | Eliminates hardcoded registrations |
| 5 | AI Sandbox | Critical | Small | Single security pipeline for all tools |
| 6 | Semantic Cache | High | Medium | 40-60% cost reduction, 10x latency improvement |
| 7 | AI Observability | Medium | Small | Provider health, cache metrics, alerts |
| 8 | Plugin Architecture | Medium | Large | Marketplace readiness |
| 9 | Frontend Workspace APIs | Medium | Medium | Premium UX for AI Workspace |
| 10 | Future Vision (Voice, Multi-modal) | Low | Large | Long-term platform evolution |
