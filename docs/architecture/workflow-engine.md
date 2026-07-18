# Workflow Engine Architecture

## Overview

The WorkflowManager provides a graph-based execution engine for orchestrating multi-agent workflows. It supports pipeline (sequential), tree (branching), and DAG (parallel) execution patterns.

## Workflow Definition

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  type: 'pipeline' | 'tree' | 'dag';
  steps: WorkflowStep[];
  timeout?: number;
  maxConcurrency?: number;
}

interface WorkflowStep {
  id: string;
  name: string;
  agentName?: string;
  capability?: string;
  input: Record<string, unknown>;
  dependsOn: string[];
  priority: TaskPriority;
  timeout?: number;
  retryCount?: number;
  condition?: string;
  onSuccess?: string[];
  onFailure?: string[];
}
```

## Execution Flow

```
1. createWorkflow(definition)
   └── Store definition in map

2. executeWorkflow(workflowId, context)
   ├── Create WorkflowExecutionContext
   │     ├── workflowId, organizationId, userId, requestId
   │     ├── stepResults: Map<string, unknown>
   │     ├── variables: Map<string, unknown>
   │     └── status: 'running'
   │
   ├── getExecutionOrder(definition)
   │     ├── Pipeline: [[Step1], [Step2], [Step3]]
   │     ├── Tree/DAG: [[Step1], [Step2, Step3], [Step4]]
   │     └── Uses topological sort based on dependsOn
   │
   └── For each execution level:
         ├── Run all steps in parallel (Promise.all)
         ├── Store results in SharedMemoryService
         └── If all steps fail, abort workflow

3. Status tracking
   ├── getWorkflowStatus(workflowId)
   ├── cancelWorkflow(workflowId)
   └── listWorkflows(organizationId)
```

## Execution Order Resolution

### Pipeline
```
getExecutionOrder() returns [[step1], [step2], [step3], ...]
```
Each step is its own level. Simple sequential execution.

### Tree / DAG
```
getExecutionOrder() uses topological sorting:
1. Find all steps with all dependencies satisfied (none in remaining set)
2. Add them as a level
3. Remove from remaining set
4. Repeat until no steps remain
5. If circular dependency detected, force-add the first remaining step
```

## Integration Points

| Component | Integration |
|-----------|-------------|
| AgentExecutorService | Executes agent tasks for each workflow step |
| TaskDelegationService | Alternative agent-aware step execution |
| SharedMemoryService | Stores step results under `step:{stepId}` keys |
| ExecutionContext | Carries organization/user identity through workflow |

## Error Handling

- **Step failure**: If a step fails, its error is stored. Other steps in the same level continue.
- **Level failure**: If ALL steps in a level fail, the workflow is aborted.
- **Timeout**: If `definition.timeout` is exceeded, the workflow is cancelled.
- **Retry**: Individual steps can specify `retryCount` for automatic retry.
