import { Injectable, Logger } from '@nestjs/common';
import { IJobScheduler, ScheduledJobConfig } from '../interfaces/scheduler.interface';
import { generateId } from '../../constants';

@Injectable()
export class JobSchedulerService implements IJobScheduler {
  private readonly logger = new Logger(JobSchedulerService.name);
  private readonly schedules = new Map<string, ScheduledJobConfig>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly intervalTimers = new Map<string, NodeJS.Timeout>();
  private executionCounts = new Map<string, number>();

  async schedule(config: ScheduledJobConfig): Promise<string> {
    const id = config.id || generateId('sched');
    this.schedules.set(id, { ...config, id });

    if (config.cronExpression) {
      this.logger.warn(`Cron expression parsing not implemented, using interval-based for ${id}`);
      this.scheduleInterval(id, config);
    } else if (config.intervalMs) {
      this.scheduleInterval(id, config);
    } else if (config.startAt) {
      this.scheduleOnce(id, config, new Date(config.startAt).getTime() - Date.now());
    }

    this.logger.log(`Job schedule created: ${id} (${config.name})`);
    return id;
  }

  async cancel(scheduleId: string): Promise<boolean> {
    this.clearTimers(scheduleId);
    return this.schedules.delete(scheduleId);
  }

  async pause(scheduleId: string): Promise<boolean> {
    if (!this.schedules.has(scheduleId)) return false;
    this.clearTimers(scheduleId);
    return true;
  }

  async resume(scheduleId: string): Promise<boolean> {
    const config = this.schedules.get(scheduleId);
    if (!config) return false;
    if (config.intervalMs) {
      this.scheduleInterval(scheduleId, config);
    }
    return true;
  }

  async listSchedules(organizationId: string): Promise<ScheduledJobConfig[]> {
    return [...this.schedules.values()].filter((s) => s.organizationId === organizationId);
  }

  async getSchedule(scheduleId: string): Promise<ScheduledJobConfig | null> {
    return this.schedules.get(scheduleId) || null;
  }

  async getNextExecution(scheduleId: string): Promise<string | null> {
    const config = this.schedules.get(scheduleId);
    if (!config) return null;
    if (config.intervalMs) {
      return new Date(Date.now() + config.intervalMs).toISOString();
    }
    return config.startAt || null;
  }

  private scheduleInterval(id: string, config: ScheduledJobConfig): void {
    const execute = () => {
      const count = this.executionCounts.get(id) || 0;
      if (config.maxExecutions && count >= config.maxExecutions) {
        this.clearTimers(id);
        return;
      }
      this.executionCounts.set(id, count + 1);
      this.logger.debug(`Scheduled job triggered: ${id} (${config.name})`);
    };

    if (config.startAt) {
      const delay = new Date(config.startAt).getTime() - Date.now();
      if (delay > 0) {
        const timer = setTimeout(() => {
          execute();
          const interval = setInterval(execute, config.intervalMs);
          this.intervalTimers.set(id, interval);
        }, delay);
        this.timers.set(id, timer);
        return;
      }
    }

    const interval = setInterval(execute, config.intervalMs);
    this.intervalTimers.set(id, interval);
  }

  private scheduleOnce(id: string, _config: ScheduledJobConfig, delay: number): void {
    if (delay > 0) {
      const timer = setTimeout(() => {
        this.logger.debug(`One-time scheduled job triggered: ${id}`);
        this.timers.delete(id);
      }, delay);
      this.timers.set(id, timer);
    }
  }

  private clearTimers(scheduleId: string): void {
    const timer = this.timers.get(scheduleId);
    if (timer) { clearTimeout(timer); this.timers.delete(scheduleId); }
    const interval = this.intervalTimers.get(scheduleId);
    if (interval) { clearInterval(interval); this.intervalTimers.delete(scheduleId); }
  }
}
