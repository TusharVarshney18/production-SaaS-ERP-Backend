export interface ScheduledJobConfig {
  id: string;
  name: string;
  jobType: string;
  payload: Record<string, unknown>;
  cronExpression?: string;
  intervalMs?: number;
  startAt?: string;
  endAt?: string;
  maxExecutions?: number;
  organizationId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface IJobScheduler {
  schedule(config: ScheduledJobConfig): Promise<string>;
  cancel(scheduleId: string): Promise<boolean>;
  pause(scheduleId: string): Promise<boolean>;
  resume(scheduleId: string): Promise<boolean>;
  listSchedules(organizationId: string): Promise<ScheduledJobConfig[]>;
  getSchedule(scheduleId: string): Promise<ScheduledJobConfig | null>;
  getNextExecution(scheduleId: string): Promise<string | null>;
}
