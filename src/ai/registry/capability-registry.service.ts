import { Injectable, Logger } from '@nestjs/common';
import { CapabilityDefinition, ProviderPreference } from '../interfaces/runtime.interface';

@Injectable()
export class CapabilityRegistryService {
  private readonly logger = new Logger(CapabilityRegistryService.name);
  private readonly capabilities = new Map<string, CapabilityDefinition>();

  register(capability: CapabilityDefinition): void {
    const name = capability.name;
    if (this.capabilities.has(name)) {
      this.logger.warn(`Capability "${name}" is already registered. Overwriting.`);
    }
    this.capabilities.set(name, capability);
    this.logger.log(
      `Capability registered: ${name} (${capability.models.length} models, ${capability.supportedTools.length} tools)`,
    );
  }

  get(name: string): CapabilityDefinition | undefined {
    return this.capabilities.get(name);
  }

  getAll(): CapabilityDefinition[] {
    return [...this.capabilities.values()];
  }

  has(name: string): boolean {
    return this.capabilities.has(name);
  }

  getCount(): number {
    return this.capabilities.size;
  }

  findByTool(toolName: string): CapabilityDefinition[] {
    return this.getAll().filter((c) => c.supportedTools.includes(toolName));
  }

  findByModel(model: string): CapabilityDefinition[] {
    return this.getAll().filter((c) => c.models.includes(model));
  }

  findByProvider(providerName: string): CapabilityDefinition[] {
    return this.getAll().filter((c) =>
      c.providerPreferences.some((p) => p.provider === providerName),
    );
  }

  getSupportedTools(capabilityName: string): string[] {
    const cap = this.get(capabilityName);
    return cap ? cap.supportedTools : [];
  }

  getDefaultTemperature(capabilityName: string): number | undefined {
    const cap = this.get(capabilityName);
    return cap?.defaultTemperature;
  }

  getContextLimit(capabilityName: string): number | undefined {
    const cap = this.get(capabilityName);
    return cap?.contextLimit;
  }

  supportsStreaming(capabilityName: string): boolean {
    const cap = this.get(capabilityName);
    return cap?.streamingSupported ?? false;
  }

  getProviderPreferences(capabilityName: string): ProviderPreference[] {
    const cap = this.get(capabilityName);
    return cap?.providerPreferences || [];
  }

  remove(name: string): boolean {
    return this.capabilities.delete(name);
  }

  update(name: string, partial: Partial<CapabilityDefinition>): boolean {
    const existing = this.get(name);
    if (!existing) return false;
    this.capabilities.set(name, { ...existing, ...partial });
    this.logger.log(`Capability updated: ${name}`);
    return true;
  }

  search(query: string): CapabilityDefinition[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.description.toLowerCase().includes(lower) ||
        c.supportedTools.some((t) => t.toLowerCase().includes(lower)),
    );
  }
}
