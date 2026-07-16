import { Injectable, Logger, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const AI_TOOL_KEY = 'ai:tool';
export const AI_CAPABILITY_KEY = 'ai:capability';
export const AI_PERMISSION_KEY = 'ai:permission';
export const AI_METADATA_KEY = 'ai:metadata';
export const AI_PROVIDER_SUPPORT_KEY = 'ai:provider-support';

export interface ToolDecoratorMetadata {
  name: string;
  description: string;
  category?: string;
  version?: string;
}

export interface CapabilityDecoratorMetadata {
  name: string;
  description: string;
}

export interface PermissionDecoratorMetadata {
  permissions: string[];
}

export interface MetadataDecoratorEntry {
  key: string;
  value: unknown;
}

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  constructor(private readonly reflector: Reflector) {}

  getToolMetadata(target: Type): ToolDecoratorMetadata | undefined {
    return this.reflector.get<ToolDecoratorMetadata | undefined>(AI_TOOL_KEY, target);
  }

  getCapabilityMetadata(target: Type): CapabilityDecoratorMetadata | undefined {
    return this.reflector.get<CapabilityDecoratorMetadata | undefined>(AI_CAPABILITY_KEY, target);
  }

  getPermissionMetadata(target: Type): PermissionDecoratorMetadata | undefined {
    return this.reflector.get<PermissionDecoratorMetadata | undefined>(AI_PERMISSION_KEY, target);
  }

  getAllMetadata(target: Type): Record<string, unknown> {
    const entries = this.reflector.get<MetadataDecoratorEntry[] | undefined>(
      AI_METADATA_KEY,
      target,
    );
    if (!entries) return {};
    const result: Record<string, unknown> = {};
    for (const entry of entries) {
      result[entry.key] = entry.value;
    }
    return result;
  }

  getProviderSupport(target: Type): string[] | undefined {
    return this.reflector.get<string[] | undefined>(AI_PROVIDER_SUPPORT_KEY, target);
  }

  getClassMetadata(target: Type): Record<string, unknown> {
    const toolMeta = this.getToolMetadata(target);
    const capMeta = this.getCapabilityMetadata(target);
    const permMeta = this.getPermissionMetadata(target);
    const customMeta = this.getAllMetadata(target);
    const providers = this.getProviderSupport(target);

    return {
      ...(toolMeta ? { tool: toolMeta } : {}),
      ...(capMeta ? { capability: capMeta } : {}),
      ...(permMeta ? { permissions: permMeta.permissions } : {}),
      ...(providers ? { providerSupport: providers } : {}),
      ...customMeta,
    };
  }
}
