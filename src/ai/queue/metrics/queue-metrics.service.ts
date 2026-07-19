import { Injectable, Logger } from '@nestjs/common';
import { QueueMetrics } from '../dto/queue-config.dto';

interface MetricSample {
  timestamp: number;
  processingTime: number;
  success: boolean;
  jobType: string;
}

@Injectable()
export class QueueMetricsService {
  private readonly logger = new Logger(QueueMetricsService.name);
  private readonly samples: MetricSample[] = [];
  private readonly maxSamples = 1000;
  private startTime = Date.now();

  recordJob(jobType: string, processingTime: number, success: boolean): void {
    this.samples.push({ timestamp: Date.now(), processingTime, success, jobType });
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  async getMetrics(
    queueSize: number,
    activeJobs: number,
    waitingJobs: number,
    delayedJobs: number,
    workerCount: number,
    idleWorkers: number,
  ): Promise<QueueMetrics> {
    const recent = this.samples.filter((s) => Date.now() - s.timestamp < 60000);
    const totalJobs = this.samples.length;
    const completedJobs = this.samples.filter((s) => s.success).length;
    const failedJobs = this.samples.filter((s) => !s.success).length;
    const avgTime =
      completedJobs > 0
        ? this.samples.filter((s) => s.success).reduce((sum, s) => sum + s.processingTime, 0) /
          completedJobs
        : 0;
    const elapsedMin = (Date.now() - this.startTime) / 60000;
    const throughput = elapsedMin > 0 ? recent.length / elapsedMin : 0;

    return {
      totalJobs,
      activeJobs,
      waitingJobs,
      completedJobs,
      failedJobs,
      delayedJobs,
      deadLetteredJobs: 0,
      averageProcessingTimeMs: avgTime,
      throughputPerMinute: Math.round(throughput * 100) / 100,
      workerCount,
      idleWorkers,
      queueSize,
    };
  }

  reset(): void {
    this.samples.length = 0;
    this.startTime = Date.now();
  }
}
