import { Injectable, Logger } from '@nestjs/common';
import { IWorker, WorkerConfig, WorkerStatus, WorkerHeartbeat } from '../interfaces/worker.interface';

@Injectable()
export class WorkerManager {
  private readonly logger = new Logger(WorkerManager.name);
  private readonly workers = new Map<string, IWorker>();
  private readonly heartbeats = new Map<string, WorkerHeartbeat>();
  private readonly failedWorkers = new Map<string, string>();

  registerWorker(worker: IWorker): void {
    this.workers.set(worker.config.workerId, worker);
    this.logger.log(`Worker registered: ${worker.config.workerId} (${worker.config.jobTypes.join(', ')})`);
  }

  unregisterWorker(workerId: string): boolean {
    this.heartbeats.delete(workerId);
    this.failedWorkers.delete(workerId);
    return this.workers.delete(workerId);
  }

  getWorker(workerId: string): IWorker | undefined {
    return this.workers.get(workerId);
  }

  getWorkerStatus(workerId: string): WorkerStatus | undefined {
    return this.workers.get(workerId)?.getStatus();
  }

  async startWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) throw new Error(`Worker "${workerId}" not found`);
    await worker.start();
  }

  async stopWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) await worker.stop();
  }

  listWorkers(): WorkerStatus[] {
    return [...this.workers.values()].map((w) => w.getStatus());
  }

  getAvailableWorkers(jobType: string): WorkerStatus[] {
    return this.listWorkers().filter(
      (w) =>
        w.status === 'idle' && w.activeJobs < w.maxConcurrency && w.jobTypes.includes(jobType),
    );
  }

  recordHeartbeat(heartbeat: WorkerHeartbeat): void {
    this.heartbeats.set(heartbeat.workerId, heartbeat);
  }

  getHeartbeat(workerId: string): WorkerHeartbeat | undefined {
    return this.heartbeats.get(workerId);
  }

  getStaleWorkers(timeoutMs = 30000): string[] {
    const now = Date.now();
    return [...this.heartbeats.entries()]
      .filter(([, h]) => now - new Date(h.timestamp).getTime() > timeoutMs)
      .map(([id]) => id);
  }

  markFailed(workerId: string, error: string): void {
    this.failedWorkers.set(workerId, error);
    this.logger.error(`Worker marked as failed: ${workerId} - ${error}`);
  }

  getFailedWorkers(): Map<string, string> {
    return new Map(this.failedWorkers);
  }

  getWorkerCount(): number {
    return this.workers.size;
  }

  getIdleCount(): number {
    return this.listWorkers().filter((w) => w.status === 'idle').length;
  }
}
