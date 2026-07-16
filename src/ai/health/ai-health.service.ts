import { Injectable, Logger } from '@nestjs/common';
import { AIGatewayService } from '../core/ai-gateway.service';
import { ProviderHealth, HealthCheckResult } from '../dto/ai.types';

@Injectable()
export class AIHealthService {
  private readonly logger = new Logger(AIHealthService.name);

  constructor(private readonly gateway: AIGatewayService) {}

  async check(): Promise<HealthCheckResult> {
    const start = Date.now();
    const providers = await this.gateway.healthCheck();

    const allAvailable = providers.every((p) => p.available);
    const timestamp = new Date().toISOString();

    this.logger.debug(
      `Health check completed: ${allAvailable ? 'ALL_OK' : 'ISSUES_DETECTED'} ` +
        `(${providers.filter((p) => p.available).length}/${providers.length} available) ` +
        `in ${Date.now() - start}ms`,
    );

    return {
      status: allAvailable ? 'ok' : 'degraded',
      timestamp,
      providers,
    };
  }

  async providerHealth(providerName: string): Promise<ProviderHealth | null> {
    try {
      const results = await this.gateway.healthCheck();
      return results.find((p) => p.provider === providerName) || null;
    } catch (error) {
      this.logger.error(`Health check failed for ${providerName}: ${(error as Error).message}`);
      return null;
    }
  }
}
