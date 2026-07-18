# Sprint 12.9 – Enterprise AI Queue & Background Execution Platform

**Date:** 2026-07-18  
**Scope:** Queue Manager, Job Dispatcher, Workers, Retry, Dead Letter Queue, Job Scheduler, Progress Tracking, Persistence  
**Status:** Completed  

---

## Architecture Overview

The AI Queue platform provides a provider-independent, production-ready queue system for executing long-running AI jobs asynchronously.

```
User/API
    │
    ▼
QueueManagerService
    │
    ├── enqueue() → IQueueProvider → JobPersistence
    ├── getJob() → JobPersistence
    ├── cancelJob() → IQueueProvider + ProgressTracker
    └── processNextJob() → JobDispatcher
                                    │
                          ┌─────────┴──────────┐
                          ▼                    ▼
                    JobDispatcher         RetryManager
                          │                    │
                    IJobProcessor       DeadLetterManager
                          │                    │
                    Agent Runtime         ProgressTracker
                          │
                     Job Result
```

---

## File Structure

```
src/ai/queue/
├── queue.module.ts                   # NestJS module (provider-agnostic)
├── queue-manager.service.ts          # Top-level facade
├── index.ts                          # Public exports
├── interfaces/                       # All interfaces
│   ├── index.ts
│   ├── queue-provider.interface.ts   # IQueueProvider abstraction
│   ├── job-processor.interface.ts    # IJobProcessor
│   ├── worker.interface.ts           # IWorker
│   ├── retry.interface.ts            # IRetryManager
│   ├── dead-letter.interface.ts      # IDeadLetterManager
│   ├── progress.interface.ts         # IProgressTracker
│   ├── persistence.interface.ts      # IJobPersistence
│   ├── scheduler.interface.ts        # IJobScheduler
│   └── queue-error.interface.ts      # QueueError, QueueErrorCode
├── dto/
│   ├── index.ts
│   ├── job.dto.ts                    # JobDefinition, JobResult, JobType
│   └── queue-config.dto.ts           # QueueConfig, QueueMetrics
├── providers/
│   ├── index.ts
│   └── in-memory-queue.provider.ts   # InMemoryQueueProvider
├── persistence/
│   ├── index.ts
│   └── job-persistence.service.ts    # In-memory job store
├── retry/
│   ├── index.ts
│   └── retry.manager.ts              # Exponential/linear/fixed + circuit breaker
├── dead-letter/
│   ├── index.ts
│   └── dead-letter.manager.ts        # DLQ with retry/purge
├── workers/
│   ├── index.ts
│   └── worker.manager.ts             # Worker registration, heartbeat, pool
├── jobs/
│   ├── index.ts
│   ├── job-dispatcher.service.ts     # Dispatches to processors
│   └── progress-tracker.service.ts   # Per-job progress tracking
├── processors/
│   ├── index.ts
│   ├── default-job.processor.ts      # Custom jobs
│   ├── agent-workflow.processor.ts   # agent.workflow → AgentOrchestrator
│   ├── rag-indexing.processor.ts     # rag.indexing → KnowledgeManager
│   ├── mcp-tool.processor.ts         # mcp.tool-execution → MCPToolExecutor
│   └── job-processor.registry.ts     # Auto-registers all processors
├── scheduler/
│   ├── index.ts
│   └── job-scheduler.service.ts      # Recurring/delayed job scheduling
├── metrics/
│   ├── index.ts
│   └── queue-metrics.service.ts      # Throughput, latency tracking
├── events/
│   └── index.ts                      # QUEUE_EVENTS constants
└── tests/                            # 26 tests
    ├── in-memory-queue.spec.ts
    ├── retry-manager.spec.ts
    ├── dead-letter.spec.ts
    └── progress-tracker.spec.ts
```

---

## Key Components

### QueueManagerService (Facade)
- `enqueue()` — Creates job, persists it, enqueues to provider
- `getJob()` / `getJobResult()` / `getJobProgress()` — Status queries
- `cancelJob()` — Removes from queue, marks cancelled
- `retryJob()` — Creates new job from failed one
- `processNextJob()` / `processAllPending()` — Process queue
- `getStats()` — Aggregated queue metrics

### IQueueProvider (Abstraction)
```
enqueue → dequeue → acknowledge/fail/progress → remove → schedule → getJob → getStats
```
Currently implemented: `InMemoryQueueProvider`  
Future: RedisQueueProvider, BullQueueProvider, SQSQueueProvider

### RetryManager
| Strategy | Formula | Use Case |
|----------|---------|----------|
| exponential | `initialDelay * multiplier^(attempt-1)` | RAG indexing, embeddings |
| linear | `initialDelay * attempt` | MCP tools |
| fixed | `initialDelay` | AI chat |

Includes circuit breaker (opens after 5 failures, resets after 30s).

### DeadLetterManager
- `moveToDlq()` — Stores failed job with full context
- `retry()` — Creates new job from DLQ entry
- `retryAll()` / `purge()` — Batch operations
- `list()` — Query by job type

### JobProcessors
| Processor | Job Type | Integrates With |
|-----------|----------|----------------|
| AgentWorkflowProcessor | `agent.workflow` | AgentOrchestrator |
| RagIndexingProcessor | `rag.indexing` | KnowledgeManagerService |
| McpToolProcessor | `mcp.tool-execution` | MCPToolExecutorService |
| DefaultJobProcessor | `custom` | Generic passthrough |

## Provider Independence

The queue system is provider-independent via `IQueueProvider`:
- `InMemoryQueueProvider` — Default, suitable for single-process development
- Future providers implement the same interface without changing any other code

## Job Lifecycle

```
queued → processing → completed
  │          │
  │          └→ failed → DLQ → retry → queued
  │                        │
  └→ delayed → queued      └→ purge (deleted)
```

## Verification

- **npm run build** — ✅ Passes
- **npm run test** — ✅ **57 AI test suites, 478 tests passing** (4 queue suites, 26 new tests)
- **npx prisma validate** — ✅ Schema valid

## Reuse of Existing Architecture

| Queue Component | Reuses |
|----------------|--------|
| AgentWorkflowProcessor | AgentOrchestrator (multi-agent) |
| RagIndexingProcessor | KnowledgeManagerService (RAG) |
| McpToolProcessor | MCPToolExecutorService (MCP) |
| ExecutionContext | Multi-tenant identity |
| generateId() | ID generation |
| Logger | NestJS logger pattern |
| Module structure | AiModule registration pattern |
