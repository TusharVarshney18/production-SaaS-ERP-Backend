import { Injectable, Logger } from '@nestjs/common';
import { IJobPersistence, PersistenceFilter } from '../interfaces/persistence.interface';
import { JobDefinition } from '../dto/job.dto';

@Injectable()
export class JobPersistenceService implements IJobPersistence {
  private readonly logger = new Logger(JobPersistenceService.name);
  private readonly jobs = new Map<string, JobDefinition>();
  private readonly results = new Map<string, unknown>();

  async save(job: JobDefinition): Promise<void> {
    this.jobs.set(job.id, { ...job });
  }

  async get(jobId: string): Promise<JobDefinition | null> {
    return this.jobs.get(jobId) || null;
  }

  async update(jobId: string, updates: Partial<JobDefinition>): Promise<void> {
    const existing = this.jobs.get(jobId);
    if (existing) {
      this.jobs.set(jobId, { ...existing, ...updates, updatedAt: new Date().toISOString() });
    }
  }

  async delete(jobId: string): Promise<boolean> {
    return this.jobs.delete(jobId);
  }

  async list(filter: PersistenceFilter): Promise<JobDefinition[]> {
    let results = [...this.jobs.values()];
    if (filter.organizationId)
      results = results.filter((j) => j.organizationId === filter.organizationId);
    if (filter.status) results = results.filter((j) => j.status === filter.status);
    if (filter.jobType) results = results.filter((j) => j.type === filter.jobType);
    if (filter.createdAfter) results = results.filter((j) => j.createdAt >= filter.createdAfter!);
    if (filter.createdBefore) results = results.filter((j) => j.createdAt <= filter.createdBefore!);
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const offset = filter.offset || 0;
    const limit = filter.limit || 50;
    return results.slice(offset, offset + limit);
  }

  async count(filter: PersistenceFilter): Promise<number> {
    const results = await this.list({ ...filter, limit: 100000, offset: 0 });
    return results.length;
  }

  async saveResult(jobId: string, result: unknown): Promise<void> {
    this.results.set(jobId, result);
  }

  async getResult(jobId: string): Promise<unknown | null> {
    return this.results.get(jobId) || null;
  }
}
