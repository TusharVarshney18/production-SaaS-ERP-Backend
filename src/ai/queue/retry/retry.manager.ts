import { Injectable, Logger } from '@nestjs/common';
import { IRetryManager, RetryPolicy, RetryStrategy } from '../interfaces/retry.interface';

interface CircuitState {
  failures: number;
  lastFailureAt: number;
  open: boolean;
  openedAt: number;
}

@Injectable()
export class RetryManager implements IRetryManager {
  private readonly logger = new Logger(RetryManager.name);
  private readonly policies = new Map<string, RetryPolicy>();
  private readonly attempts = new Map<string, number[]>();
  private readonly circuits = new Map<string, CircuitState>();
  private readonly circuitThreshold = 5;
  private readonly circuitResetMs = 30000;

  constructor() {
    this.setDefaultPolicies();
  }

  async shouldRetry(jobId: string, attempt: number, error: string): Promise<boolean> {
    if (this.isCircuitOpen(jobId)) {
      this.logger.warn(`Circuit open for job ${jobId}, not retrying`);
      return false;
    }

    this.recordCircuitFailure(jobId, error);

    const policy = this.policies.get('default') || this.getDefaultPolicy();
    return attempt <= policy.maxRetries;
  }

  async getDelay(_jobId: string, attempt: number): Promise<number> {
    const policy = this.policies.get('default') || this.getDefaultPolicy();
    switch (policy.strategy) {
      case 'exponential':
        return Math.min(policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1), policy.maxDelayMs);
      case 'linear':
        return policy.initialDelayMs * attempt;
      case 'fixed':
      default:
        return policy.initialDelayMs;
    }
  }

  async recordAttempt(jobId: string, attempt: number, _error: string): Promise<void> {
    if (!this.attempts.has(jobId)) {
      this.attempts.set(jobId, []);
    }
    this.attempts.get(jobId)!.push(attempt);
  }

  getRetryPolicy(jobType: string): RetryPolicy {
    return this.policies.get(jobType) || this.getDefaultPolicy();
  }

  setRetryPolicy(jobType: string, policy: RetryPolicy): void {
    this.policies.set(jobType, policy);
    this.logger.log(`Retry policy set for ${jobType}: ${policy.strategy} (max ${policy.maxRetries})`);
  }

  private setDefaultPolicies(): void {
    this.setRetryPolicy('default', this.getDefaultPolicy());
    this.setRetryPolicy('rag.indexing', {
      strategy: 'exponential', maxRetries: 3, initialDelayMs: 2000, maxDelayMs: 60000, backoffMultiplier: 2,
      retryOnTimeout: true, retryOnError: true,
    });
    this.setRetryPolicy('rag.embedding', {
      strategy: 'exponential', maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 30000, backoffMultiplier: 2,
      retryOnTimeout: true, retryOnError: true,
    });
    this.setRetryPolicy('mcp.tool-execution', {
      strategy: 'linear', maxRetries: 2, initialDelayMs: 1000, maxDelayMs: 5000, backoffMultiplier: 1,
      retryOnTimeout: false, retryOnError: true,
    });
    this.setRetryPolicy('ai.chat', {
      strategy: 'fixed', maxRetries: 1, initialDelayMs: 2000, maxDelayMs: 2000, backoffMultiplier: 1,
      retryOnTimeout: true, retryOnError: false,
    });
  }

  private getDefaultPolicy(): RetryPolicy {
    return {
      strategy: 'exponential', maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 30000, backoffMultiplier: 2,
      retryOnTimeout: true, retryOnError: true,
    };
  }

  private getMaxRetries(jobId: string): number {
    const attempts = this.attempts.get(jobId);
    return attempts ? attempts.length + 1 : 1;
  }

  private isCircuitOpen(jobId: string): boolean {
    const circuit = this.circuits.get(jobId);
    if (!circuit || !circuit.open) return false;
    if (Date.now() - circuit.openedAt > this.circuitResetMs) {
      circuit.open = false;
      circuit.failures = 0;
      return false;
    }
    return true;
  }

  private recordCircuitFailure(jobId: string, _error: string): void {
    if (!this.circuits.has(jobId)) {
      this.circuits.set(jobId, { failures: 0, lastFailureAt: 0, open: false, openedAt: 0 });
    }
    const circuit = this.circuits.get(jobId)!;
    circuit.failures++;
    circuit.lastFailureAt = Date.now();
    if (circuit.failures >= this.circuitThreshold) {
      circuit.open = true;
      circuit.openedAt = Date.now();
      this.logger.warn(`Circuit opened for job ${jobId} after ${circuit.failures} failures`);
    }
  }
}
