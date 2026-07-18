export const MULTI_AGENT_EVENTS = {
  TASK_STARTED: 'multi-agent:task:started',
  TASK_COMPLETED: 'multi-agent:task:completed',
  TASK_FAILED: 'multi-agent:task:failed',
  WORKFLOW_STARTED: 'multi-agent:workflow:started',
  WORKFLOW_COMPLETED: 'multi-agent:workflow:completed',
  WORKFLOW_FAILED: 'multi-agent:workflow:failed',
  CONSENSUS_REACHED: 'multi-agent:consensus:reached',
  CONSENSUS_FAILED: 'multi-agent:consensus:failed',
  AGENT_MESSAGE: 'multi-agent:agent:message',
  ORCHESTRATION_STARTED: 'multi-agent:orchestration:started',
  ORCHESTRATION_COMPLETED: 'multi-agent:orchestration:completed',
} as const;
