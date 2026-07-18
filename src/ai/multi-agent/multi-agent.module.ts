import { Module } from '@nestjs/common';
import { AgentOrchestrator } from './orchestrator/agent-orchestrator.service';
import { TaskPlannerService } from './planner/task-planner.service';
import { TaskCoordinator } from './coordinator/task-coordinator.service';
import { AgentMessagingService } from './messaging/agent-messaging.service';
import { TaskDelegationService } from './delegation/task-delegation.service';
import { ConsensusEngine } from './consensus/consensus.engine';
import { SharedMemoryService } from './shared-memory/shared-memory.service';
import { WorkflowManager } from './workflows/workflow.manager';
import { ExecutionScheduler } from './scheduler/execution-scheduler.service';

@Module({
  providers: [
    AgentOrchestrator,
    TaskPlannerService,
    TaskCoordinator,
    AgentMessagingService,
    TaskDelegationService,
    ConsensusEngine,
    SharedMemoryService,
    WorkflowManager,
    ExecutionScheduler,
  ],
  exports: [
    AgentOrchestrator,
    TaskPlannerService,
    TaskCoordinator,
    AgentMessagingService,
    TaskDelegationService,
    ConsensusEngine,
    SharedMemoryService,
    WorkflowManager,
    ExecutionScheduler,
  ],
})
export class MultiAgentModule {}
