import { Injectable, Logger } from '@nestjs/common';
import { AITool } from '../tools/interfaces/ai-tool.interface';
import { ToolMetadata } from '../interfaces/runtime.interface';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, AITool>();

  register(tool: AITool): void {
    const name = tool.name;
    if (this.tools.has(name)) {
      this.logger.warn(`Tool "${name}" is already registered. Overwriting.`);
    }
    this.tools.set(name, tool);
    this.logger.log(`Tool registered: ${name} (v${tool.version}, category: ${tool.category})`);
  }

  get(name: string): AITool | undefined {
    return this.tools.get(name);
  }

  getAll(): AITool[] {
    return [...this.tools.values()];
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getCount(): number {
    return this.tools.size;
  }

  findByCategory(category: string): AITool[] {
    return this.getAll().filter((t) => t.category.toLowerCase() === category.toLowerCase());
  }

  search(query: string): AITool[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.category.toLowerCase().includes(lower),
    );
  }

  getToolDefinitions(): ToolMetadata[] {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      version: tool.version,
      category: tool.category,
      tags: [],
      parameters: tool.parameters,
      permissions: tool.permissions,
      timeout: tool.timeout,
      requiresConfirmation: tool.requiresConfirmation,
      providerSupport: tool.providerSupport,
      metadata: tool.metadata,
    }));
  }

  getToolDefinition(name: string): ToolMetadata | undefined {
    const tool = this.get(name);
    if (!tool) return undefined;
    return {
      name: tool.name,
      description: tool.description,
      version: tool.version,
      category: tool.category,
      tags: [],
      parameters: tool.parameters,
      permissions: tool.permissions,
      timeout: tool.timeout,
      requiresConfirmation: tool.requiresConfirmation,
      providerSupport: tool.providerSupport,
      metadata: tool.metadata,
    };
  }

  remove(name: string): boolean {
    return this.tools.delete(name);
  }

  getToolNames(): string[] {
    return [...this.tools.keys()];
  }

  getCategories(): string[] {
    const cats = new Set<string>();
    for (const tool of this.tools.values()) {
      cats.add(tool.category);
    }
    return [...cats].sort();
  }
}
