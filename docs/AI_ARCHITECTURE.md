# AI Platform Architecture

## Overview

The ERPX AI Platform is an **AI Operating System** that sits between business modules and LLM providers. Every AI capability flows through this platform — business modules never communicate directly with LLMs.

## Core Principles

1. **Provider Independence** — No hard coupling to any LLM provider. Swap OpenAI for Claude with a config change.
2. **Tool-Based Access** — AI never accesses Prisma or databases directly. All data access is through registered, permission-gated tools.
3. **Organization Isolation** — Every AI operation is scoped to an organization. Cross-org data leakage is impossible.
4. **Observability First** — Every prompt, token, latency, and cost is tracked. AI operations are fully auditable.
5. **Security by Default** — Prompt injection mitigation, data masking, rate limiting, and permission checks happen at every layer.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (AI Workspace)                      │
│          Chat · Agent Switching · History · Context Panel           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP / SSE (Streaming)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AI PLATFORM (src/ai/)                           │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Router  │  │  Agents  │  │  Tools   │  │  Conversation    │   │
│  │  Layer   │──│  Layer   │──│  Layer   │──│  Manager         │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│       │              │              │               │              │
│       ▼              ▼              ▼               ▼              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │Provider  │  │Memory    │  │RAG       │  │  Prompt          │   │
│  │Factory   │  │Manager   │  │Engine    │  │  Registry        │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│       │              │              │               │              │
│       ▼              ▼              ▼               ▼              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Security Layer (Permissions, Audit, Masking)    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   ERP MODULES (accessed via Tools ONLY)              │
│                                                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ CRM  │ │Sales │ │Inv.  │ │Proc. │ │Acct. │ │ HRMS │ │Wkfl. │  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Module Structure (src/ai/)

```
src/ai/
├── ai.module.ts                       # Root module
├── ai.controller.ts                   # Chat, streaming, agent endpoints
│
├── core/
│   ├── ai-router.service.ts           # Routes requests to correct agent/provider
│   ├── ai-gateway.service.ts          # Unified entry point for all AI requests
│   └── ai-stream.service.ts           # SSE streaming handler
│
├── providers/
│   ├── provider.interface.ts          # IProvider contract
│   ├── provider.factory.ts            # Provider selection + fallback
│   ├── provider-router.service.ts     # Routes by model/capability/cost
│   ├── openai/
│   │   ├── openai.provider.ts
│   │   └── openai.config.ts
│   ├── gemini/
│   │   ├── gemini.provider.ts
│   │   └── gemini.config.ts
│   ├── claude/
│   │   ├── claude.provider.ts
│   │   └── claude.config.ts
│   ├── ollama/
│   │   ├── ollama.provider.ts
│   │   └── ollama.config.ts
│   ├── azure-openai/
│   │   ├── azure-openai.provider.ts
│   │   └── azure-openai.config.ts
│   ├── bedrock/
│   │   ├── bedrock.provider.ts
│   │   └── bedrock.config.ts
│   └── fallback.service.ts            # Fallback chain logic
│
├── agents/
│   ├── agent.interface.ts             # IAgent contract
│   ├── agent-registry.service.ts      # Agent registration + discovery
│   ├── agent-orchestrator.service.ts  # Multi-agent coordination
│   ├── ceo/
│   │   └── ceo.agent.ts
│   ├── finance/
│   │   └── finance.agent.ts
│   ├── sales/
│   │   └── sales.agent.ts
│   ├── inventory/
│   │   └── inventory.agent.ts
│   ├── procurement/
│   │   └── procurement.agent.ts
│   ├── hr/
│   │   └── hr.agent.ts
│   ├── reporting/
│   │   └── reporting.agent.ts
│   └── developer/
│       └── developer.agent.ts
│
├── tools/
│   ├── tool.interface.ts              # ITool contract
│   ├── tool-registry.service.ts       # Tool registration
│   ├── tool-executor.service.ts       # Permission checks + execution
│   ├── crm.tool.ts
│   ├── sales.tool.ts
│   ├── inventory.tool.ts
│   ├── procurement.tool.ts
│   ├── accounting.tool.ts
│   ├── hrms.tool.ts
│   ├── reporting.tool.ts
│   ├── workflow.tool.ts
│   └── payment.tool.ts
│
├── memory/
│   ├── memory.interface.ts            # IMemoryStore contract
│   ├── memory-manager.service.ts      # Orchestrates memory layers
│   ├── session-memory.service.ts      # Per-session (short term)
│   ├── long-term-memory.service.ts    # Per-user/organization (persisted)
│   └── memory-compactor.service.ts    # Summarizes old conversations
│
├── conversation/
│   ├── conversation.service.ts        # CRUD for conversations
│   └── conversation.entity.ts        # Message, thread models
│
├── knowledge/
│   ├── knowledge-base.service.ts      # Document management
│   └── knowledge-source.entity.ts
│
├── embeddings/
│   ├── embeddings.service.ts          # Vector embedding generation
│   └── embedding-provider.factory.ts  # OpenAI/other embedding providers
│
├── rag/
│   ├── rag-engine.service.ts          # Retrieve + augment + generate
│   ├── rag-indexer.service.ts         # Document indexing pipeline
│   └── rag-retriever.service.ts       # Vector + keyword hybrid search
│
├── prompts/
│   ├── prompt-registry.service.ts     # Loads prompts from files/db
│   ├── prompt-renderer.service.ts     # Variable substitution
│   └── prompt-version.service.ts      # Version management
│
├── permissions/
│   ├── ai-permission.service.ts       # AI-specific permission checks
│   └── ai-permission.guard.ts         # NestJS guard for AI endpoints
│
├── usage/
│   ├── usage-tracker.service.ts       # Token + request tracking
│   └── usage.entity.ts
│
├── audit/
│   └── ai-audit.service.ts            # AI-specific audit logging
│
├── dto/
│   ├── chat-request.dto.ts
│   ├── chat-response.dto.ts
│   ├── agent-request.dto.ts
│   └── streaming-response.dto.ts
│
└── tests/
    ├── providers/
    ├── agents/
    ├── tools/
    └── memory/
```

## Request Flow

```
User Message
    │
    ▼
AI Controller
    │
    ▼
AI Gateway
    │
    ├──→ Permission Check (can user access AI?)
    ├──→ Rate Limit Check
    ├──→ Load Agent Configuration
    │
    ▼
Agent Router
    │
    ├──→ CEO Agent  ──→  Tools: Reporting, All
    ├──→ Finance Agent ──→ Tools: Accounting, Payment
    ├──→ Sales Agent ──→ Tools: CRM, Sales
    └──→ ...
    │
    ▼
Provider Router
    │
    ├──→ Select Provider (by config, cost, capability)
    ├──→ Check Fallback (if primary unavailable)
    │
    ▼
Prompt Renderer
    │
    ├──→ Load System Prompt (from registry)
    ├──→ Inject Context (from memory/RAG)
    ├──→ Inject Available Tools
    │
    ▼
Security Layer
    │
    ├──→ Mask Sensitive Data
    ├──→ Validate Tool Permissions
    │
    ▼
LLM Provider (OpenAI / Claude / Gemini / ...)
    │
    ▼
Response
    │
    ├──→ Tool Executor (if tool call)
    │       │
    │       ├──→ Validate Permission
    │       ├──→ Execute Tool (calls business module)
    │       ├──→ Mask Response
    │       └──→ Return to LLM
    │
    ├──→ Memory Manager (save to history)
    ├──→ Usage Tracker (count tokens)
    ├──→ AI Audit (log everything)
    │
    ▼
Stream back to Frontend (SSE)
```

## Integration with Existing Modules

```
┌──────────────────────────────────────────────────────────────┐
│                    WORKFLOW ENGINE                            │
│                                                               │
│  InvoicePaid ──→ AI_HOOK Action ──→ EventBusService          │
│                                          │                    │
│                                          ▼                    │
│                                   AI Gateway                  │
│                                          │                    │
│                                    Finance Agent              │
│                                          │                    │
│                                   Generate Summary            │
│                                          │                    │
│                                   Post to Conversation       │
│                                   Create Notification        │
└──────────────────────────────────────────────────────────────┘
```

The Workflow Engine's `AI_HOOK` action type (designed in Sprint 11) is the bridge. When a workflow matches an event, the `AiHookActionService` forwards it to the AI Gateway, which routes to the appropriate agent.

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Tools-only data access | Prevents SQL injection, enforces permissions, enables audit |
| Provider abstraction | Avoid vendor lock-in, enables cost optimization per model |
| Agent specialization | Each agent has scoped tools, focused system prompts |
| Prompt registry outside TS | Prompts can be updated without deployments |
| Memory layering | Short-term for context, long-term for learning, org-level for policies |
| SSE streaming | Required for responsive chat UX |
| Usage tracking at platform level | Single source of truth for costs, billing |

## Scalability Considerations

- **Horizontal scaling**: AI Gateway is stateless. Providers are called externally. Memory uses PostgreSQL (or optional Redis).
- **Rate limiting per org**: Organizations share a pool of tokens. Configurable limits per tier.
- **Provider fallback chain**: If OpenAI is down, fallback to Claude → Gemini → Ollama (local).
- **Batch processing**: Non-urgent AI tasks (RAG indexing, memory compaction) use background queues.
- **Caching**: Repeated prompts with identical context can be cached at the gateway level.
