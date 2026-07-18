# Multi-Agent Collaboration Architecture

## System Architecture

```
                        ┌─────────────────────────┐
                        │   User / API Request     │
                        └────────────┬────────────┘
                                     │
                        ┌────────────▼────────────┐
                        │    AgentOrchestrator     │
                        │                         │
                        │  orchestrate()           │
                        │  orchestrateWithAgents() │
                        │  cancel()                │
                        └────┬──────────────┬─────┘
                             │              │
                    ┌────────▼────┐  ┌──────▼──────────┐
                    │ TaskPlanner  │  │ WorkflowManager  │
                    │              │  │                  │
                    │ decompose()  │  │ createWorkflow() │
                    │ validate()   │  │ executeWorkflow()│
                    │ getOrder()   │  │ cancelWorkflow() │
                    └────────┬────┘  └──────┬──────────┘
                             │              │
                    ┌────────▼──────────────▼─────┐
                    │     TaskCoordinator           │
                    │                              │
                    │  coordinate()                 │
                    │  executeSubtask()             │
                    │  cancelCoordination()         │
                    └────────────┬─────────────────┘
                                 │
                    ┌────────────▼─────────────────┐
                    │    TaskDelegationService       │
                    │                               │
                    │  delegate() → AgentRegistry    │
                    │  findBestAgent() → AgentExec   │
                    │  getWorkload() → load balance  │
                    └────────────┬─────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
       ┌──────────┐      ┌──────────┐      ┌──────────┐
       │  Agent   │      │  Agent   │      │  Agent   │
       │ Executor │      │ Executor │      │ Executor │
       └──────────┘      └──────────┘      └──────────┘
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 │
                    ┌────────────▼─────────────────┐
                    │    SharedMemoryService         │
                    │                               │
                    │  set() / get() / query()       │
                    │  clearWorkflowMemory()         │
                    └────────────┬─────────────────┘
                                 │
                    ┌────────────▼─────────────────┐
                    │    ConsensusEngine             │
                    │                               │
                    │  evaluate() → majority vote    │
                    │  addVote() / approveHuman()    │
                    └───────────────────────────────┘
```

## Service Dependencies

```
AgentOrchestrator
  ├── TaskPlannerService
  │     └── AgentRegistryService
  ├── TaskCoordinator
  │     ├── TaskPlannerService
  │     ├── TaskDelegationService
  │     │     ├── AgentRegistryService
  │     │     └── AgentExecutorService
  │     └── SharedMemoryService
  ├── WorkflowManager
  │     ├── AgentExecutorService
  │     ├── TaskDelegationService
  │     └── SharedMemoryService
  ├── ConsensusEngine
  └── SharedMemoryService
```

## Agent Communication Patterns

### Direct Request/Response
```
AgentA ──sendAndWait──► AgentB
AgentA ◄──response───── AgentB
```

### Broadcast
```
AgentA ──broadcast──► [AgentB, AgentC, AgentD]
```

### Event-driven
```
AgentA ──publishEvent("data.ready")──► EventBus
                                          │
                    ┌─────────────────────┼──────────┐
                    ▼                     ▼          ▼
                AgentB                 AgentC     AgentD
               (subscriber)          (subscriber)
```

## Workflow Types

### Pipeline (Sequential)
```
Step1 → Step2 → Step3 → Step4
```
Each step runs after the previous completes.

### Tree (Branching)
```
         ┌── Step2 ──┐
Step1 ───┤           ├─── Step4
         └── Step3 ──┘
```
Steps 2 and 3 run in parallel after Step1.

### DAG (Directed Acyclic Graph)
```
    ┌── Step2 ──┐
Step1┤           ├─── Step4
    └── Step3 ──┘───┤
                    └── Step5
```
Steps with satisfied dependencies run in parallel.

## Consensus Strategies

| Strategy | Threshold | Human Approval | Use Case |
|----------|-----------|----------------|----------|
| SIMPLE_MAJORITY | >50% | No | General decisions |
| SUPER_MAJORITY | >66% | No | Important decisions |
| UNANIMOUS | 100% | Yes | Critical decisions |
| WEIGHTED | >50% (weighted) | No | Hierarchical decisions |

## Delegation Strategies

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| capability-match | Best capability match | Default |
| least-loaded | Lowest active task count | Load balancing |
| priority | Highest priority agent | Critical tasks |
