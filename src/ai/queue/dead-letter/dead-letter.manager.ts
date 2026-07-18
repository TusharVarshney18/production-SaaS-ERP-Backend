import { Injectable, Logger } from '@nestjs/common';
import { IDeadLetterManager, DeadLetterEntry } from '../interfaces/dead-letter.interface';
import { JobDefinition } from '../dto/job.dto';
import { generateId } from '../../constants';

@Injectable()
export class DeadLetterManager implements IDeadLetterManager {
  private readonly logger = new Logger(DeadLetterManager.name);
  private readonly entries = new Map<string, DeadLetterEntry>();

  async moveToDlq(job: JobDefinition, reason: string, error: string): Promise<string> {
    const id = generateId('dlq');
    const entry: DeadLetterEntry = {
      id,
      originalJob: job,
      reason,
      error,
      attempts: job.attempts,
      failedAt: new Date().toISOString(),
      lastError: error,
    };
    this.entries.set(id, entry);
    this.logger.warn(`Job moved to DLQ: ${id} (${job.type}, reason: ${reason})`);
    return id;
  }

  async retry(entryId: string): Promise<string | null> {
    const entry = this.entries.get(entryId);
    if (!entry) return null;

    this.entries.delete(entryId);
    const retryJob: JobDefinition = {
      ...entry.originalJob,
      id: generateId('job'),
      status: 'queued',
      attempts: 0,
      error: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.logger.log(`DLQ entry ${entryId} retried as job ${retryJob.id}`);
    return retryJob.id;
  }

  async retryAll(jobType?: string): Promise<number> {
    let count = 0;
    for (const [id, entry] of this.entries.entries()) {
      if (jobType && entry.originalJob.type !== jobType) continue;
      this.entries.delete(id);
      count++;
    }
    this.logger.log(`Retried ${count} DLQ entries${jobType ? ` for type ${jobType}` : ''}`);
    return count;
  }

  async purge(jobType?: string): Promise<number> {
    let count = 0;
    if (jobType) {
      for (const [id, entry] of this.entries.entries()) {
        if (entry.originalJob.type === jobType) {
          this.entries.delete(id);
          count++;
        }
      }
    } else {
      count = this.entries.size;
      this.entries.clear();
    }
    this.logger.log(`Purged ${count} DLQ entries${jobType ? ` for type ${jobType}` : ''}`);
    return count;
  }

  async list(jobType?: string): Promise<DeadLetterEntry[]> {
    let entries = [...this.entries.values()];
    if (jobType) entries = entries.filter((e) => e.originalJob.type === jobType);
    return entries.sort((a, b) => new Date(b.failedAt).getTime() - new Date(a.failedAt).getTime());
  }

  async get(entryId: string): Promise<DeadLetterEntry | null> {
    return this.entries.get(entryId) || null;
  }

  async getCount(): Promise<number> {
    return this.entries.size;
  }
}
