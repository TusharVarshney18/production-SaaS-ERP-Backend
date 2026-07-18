import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '../../execution/execution-context';
import { ToolRegistryService } from '../../registry/tool-registry.service';
import { CapabilityRegistryService } from '../../registry/capability-registry.service';
import { ProviderFactory } from '../../providers/provider.factory';

@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly capabilityRegistry: CapabilityRegistryService,
    private readonly providerFactory: ProviderFactory,
  ) {}

  buildBaseContext(params: {
    organizationId: string;
    userId: string;
    requestId?: string;
    correlationId?: string;
    role?: string;
    ipAddress?: string;
    userAgent?: string;
  }): ExecutionContext {
    return {
      organizationId: params.organizationId,
      userId: params.userId,
      requestId: params.requestId || `ai-${Date.now()}`,
      correlationId: params.correlationId,
      role: params.role,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        availableTools: this.toolRegistry.getToolNames(),
        availableCapabilities: this.capabilityRegistry.getAll().map((c) => c.name),
        availableProviders: this.providerFactory.getRegisteredProviders(),
        defaultTemperature: this.configService.get<number>('ai.temperature', 0.7),
        streaming: this.configService.get<boolean>('ai.streaming', true),
      },
    };
  }

  buildContext(params: {
    organizationId: string;
    userId: string;
    requestId?: string;
    correlationId?: string;
    role?: string;
    ipAddress?: string;
    userAgent?: string;
    extraMetadata?: Record<string, unknown>;
  }): ExecutionContext {
    const context = this.buildBaseContext(params);

    if (params.extraMetadata) {
      context.metadata = { ...context.metadata, ...params.extraMetadata };
    }

    return context;
  }

  getAvailableToolsSummary(): { name: string; category: string; description: string }[] {
    return this.toolRegistry.getAll().map((tool) => ({
      name: tool.name,
      category: tool.category,
      description: tool.description,
    }));
  }

  getProviderSummary(): { name: string; models: string[] }[] {
    return this.providerFactory.getAvailableProviders().map((p) => ({
      name: p.name,
      models: p.models,
    }));
  }

  getCapabilitySummary(): { name: string; tools: string[] }[] {
    return this.capabilityRegistry.getAll().map((c) => ({
      name: c.name,
      tools: c.supportedTools,
    }));
  }
}
