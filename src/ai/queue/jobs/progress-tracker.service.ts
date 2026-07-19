import { Injectable, Logger } from '@nestjs/common';
import { IProgressTracker, JobProgress } from '../interfaces/progress.interface';

@Injectable()
export class ProgressTracker implements IProgressTracker {
  private readonly logger = new Logger(ProgressTracker.name);
  private readonly progressMap = new Map<string, JobProgress>();

  async track(jobId: string, percentage: number, message?: string): Promise<void> {
    const progress = this.getOrCreate(jobId);
    progress.percentage = Math.min(100, Math.max(0, percentage));
    if (message) {
      progress.message = message;
      progress.logs.push(`[${new Date().toISOString()}] ${message}`);
    }
    this.logger.debug(`Job ${jobId} progress: ${percentage}%${message ? ` - ${message}` : ''}`);
  }

  async getProgress(jobId: string): Promise<JobProgress | null> {
    return this.progressMap.get(jobId) || null;
  }

  async log(jobId: string, message: string): Promise<void> {
    const progress = this.getOrCreate(jobId);
    progress.logs.push(`[${new Date().toISOString()}] ${message}`);
  }

  async markStarted(jobId: string): Promise<void> {
    const progress = this.getOrCreate(jobId);
    progress.status = 'processing';
    progress.startedAt = new Date().toISOString();
    progress.logs.push(`[${new Date().toISOString()}] Job started`);
  }

  async markCompleted(jobId: string, _result?: unknown): Promise<void> {
    const progress = this.getOrCreate(jobId);
    progress.status = 'completed';
    progress.percentage = 100;
    progress.completedAt = new Date().toISOString();
    progress.logs.push(`[${new Date().toISOString()}] Job completed`);
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    const progress = this.getOrCreate(jobId);
    progress.status = 'failed';
    progress.completedAt = new Date().toISOString();
    progress.logs.push(`[${new Date().toISOString()}] Job failed: ${error}`);
  }

  async markCancelled(jobId: string): Promise<void> {
    const progress = this.getOrCreate(jobId);
    progress.status = 'cancelled';
    progress.completedAt = new Date().toISOString();
    progress.logs.push(`[${new Date().toISOString()}] Job cancelled`);
  }

  async getAllProgress(_organizationId: string): Promise<JobProgress[]> {
    return [...this.progressMap.values()];
  }

  private getOrCreate(jobId: string): JobProgress {
    if (!this.progressMap.has(jobId)) {
      this.progressMap.set(jobId, {
        jobId,
        percentage: 0,
        status: 'queued',
        logs: [],
      });
    }
    return this.progressMap.get(jobId)!;
  }
}
