import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { PromptDefinition, PromptVariable } from '../interfaces/runtime.interface';

interface CachedPrompt {
  prompt: PromptDefinition;
  loadedAt: number;
  version: string;
}

@Injectable()
export class PromptRegistryService {
  private readonly logger = new Logger(PromptRegistryService.name);
  private readonly prompts = new Map<string, CachedPrompt>();
  private readonly cacheTtlMs: number;
  private readonly promptsDir: string;

  constructor(private readonly configService: ConfigService) {
    this.cacheTtlMs = this.configService.get<number>('ai.promptCacheTtl', 300000);
    this.promptsDir = this.configService.get<string>('ai.promptsDir', '');
  }

  register(prompt: PromptDefinition): void {
    const key = this.buildKey(prompt.name, prompt.version);
    this.prompts.set(key, { prompt, loadedAt: Date.now(), version: prompt.version });
    this.logger.log(`Prompt registered: ${key}`);
  }

  get(name: string, version?: string): PromptDefinition | undefined {
    const key = this.buildKey(name, version || 'latest');
    const cached = this.prompts.get(key);

    if (!cached) {
      if (version) return undefined;
      return this.findLatest(name);
    }

    if (Date.now() - cached.loadedAt > this.cacheTtlMs) {
      this.prompts.delete(key);
      if (version) return undefined;
      return this.findLatest(name);
    }

    return cached.prompt;
  }

  getVersioned(name: string, version: string): PromptDefinition | undefined {
    return this.get(name, version);
  }

  getAll(): PromptDefinition[] {
    const valid: PromptDefinition[] = [];
    const now = Date.now();
    for (const cached of this.prompts.values()) {
      if (now - cached.loadedAt <= this.cacheTtlMs) {
        valid.push(cached.prompt);
      }
    }
    return valid;
  }

  getAllVersions(name: string): PromptDefinition[] {
    const versions: PromptDefinition[] = [];
    const now = Date.now();
    for (const [key, cached] of this.prompts.entries()) {
      if (key.startsWith(`${name}@`) && now - cached.loadedAt <= this.cacheTtlMs) {
        versions.push(cached.prompt);
      }
    }
    return versions;
  }

  search(query: string): PromptDefinition[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.description && p.description.toLowerCase().includes(lower)) ||
        p.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  }

  render(name: string, variables: Record<string, string>, version?: string): string {
    const prompt = this.get(name, version);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}${version ? `@${version}` : ''}`);
    }

    let rendered = prompt.template;
    for (const variable of prompt.variables) {
      const hasValue = variables[variable.name] !== undefined;
      const value = variables[variable.name] ?? variable.defaultValue;

      if (!hasValue && variable.required && value === undefined) {
        throw new Error(`Required variable "${variable.name}" not provided for prompt "${name}"`);
      }

      if (value !== undefined) {
        rendered = rendered.replace(new RegExp(`\\{\\{\\s*${variable.name}\\s*\\}\\}`, 'g'), value);
      }
    }

    return rendered;
  }

  validate(prompt: PromptDefinition): string[] {
    const errors: string[] = [];

    if (!prompt.name) errors.push('Prompt name is required');
    if (!prompt.version) errors.push('Prompt version is required');
    if (!prompt.template) errors.push('Prompt template is required');

    if (prompt.template) {
      const declaredVars = new Set(prompt.variables.map((v) => v.name));
      const templateVars = prompt.template.match(/\{\{\s*(\w+)\s*\}\}/g);
      if (templateVars) {
        for (const match of templateVars) {
          const varName = match.replace(/\{\{\s*|\s*\}\}/g, '');
          if (!declaredVars.has(varName)) {
            errors.push(`Variable "${varName}" found in template but not declared`);
          }
        }
      }
    }

    const seen = new Set<string>();
    for (const v of prompt.variables) {
      if (seen.has(v.name)) {
        errors.push(`Duplicate variable declaration: "${v.name}"`);
      }
      seen.add(v.name);
    }

    return errors;
  }

  loadFromFile(filePath: string): PromptDefinition | null {
    try {
      if (!existsSync(filePath)) {
        this.logger.warn(`Prompt file not found: ${filePath}`);
        return null;
      }

      const content = readFileSync(filePath, 'utf-8');
      let parsed: Partial<PromptDefinition>;

      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = this.parseFrontmatter(content);
      }

      const prompt = this.normalizePrompt(parsed);
      this.register(prompt);
      return prompt;
    } catch (error) {
      this.logger.error(`Failed to load prompt from ${filePath}: ${error.message}`);
      return null;
    }
  }

  loadFromDirectory(dirPath?: string): number {
    const targetDir = dirPath || this.promptsDir;
    if (!targetDir || !existsSync(targetDir)) {
      this.logger.warn(`Prompts directory not found: ${targetDir}`);
      return 0;
    }

    let count = 0;
    const files = readdirSync(targetDir);

    for (const file of files) {
      const fullPath = join(targetDir, file);
      if (
        statSync(fullPath).isFile() &&
        (extname(file) === '.json' || extname(file) === '.yaml' || extname(file) === '.yml')
      ) {
        const loaded = this.loadFromFile(fullPath);
        if (loaded) count++;
      }
    }

    this.logger.log(`Loaded ${count} prompts from ${targetDir}`);
    return count;
  }

  clearCache(): void {
    this.prompts.clear();
    this.logger.log('Prompt cache cleared');
  }

  getCacheSize(): number {
    return this.prompts.size;
  }

  remove(name: string, version?: string): boolean {
    if (version) {
      return this.prompts.delete(this.buildKey(name, version));
    }

    const keysToDelete: string[] = [];
    const prefix = `${name}@`;
    for (const key of this.prompts.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    if (keysToDelete.length === 0) return false;
    for (const key of keysToDelete) {
      this.prompts.delete(key);
    }
    return true;
  }

  private buildKey(name: string, version: string): string {
    return `${name}@${version}`;
  }

  private findLatest(name: string): PromptDefinition | undefined {
    let latest: PromptDefinition | undefined;
    let latestVersion = '';

    for (const cached of this.prompts.values()) {
      if (cached.prompt.name === name && Date.now() - cached.loadedAt <= this.cacheTtlMs) {
        if (!latest || cached.version > latestVersion) {
          latest = cached.prompt;
          latestVersion = cached.version;
        }
      }
    }

    return latest;
  }

  private parseFrontmatter(content: string): Partial<PromptDefinition> {
    const lines = content.split('\n');
    let name = '';
    let version = '1.0.0';
    let description = '';
    const tags: string[] = [];
    const variables: PromptVariable[] = [];
    let templateStart = 0;

    if (lines[0] && lines[0].trim() === '---') {
      let i = 1;
      while (i < lines.length && lines[i].trim() !== '---') {
        const line = lines[i].trim();
        if (line.startsWith('name:')) name = line.substring(5).trim();
        else if (line.startsWith('version:')) version = line.substring(8).trim();
        else if (line.startsWith('description:')) description = line.substring(12).trim();
        else if (line.startsWith('tags:')) {
          const tagStr = line.substring(5).trim();
          tags.push(
            ...tagStr
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
          );
        } else if (line.startsWith('variables:')) {
          i++;
          while (
            i < lines.length &&
            lines[i].trim() !== '---' &&
            (lines[i].trim().startsWith('-') || lines[i].trim().startsWith('  '))
          ) {
            const varLine = lines[i].trim();
            if (varLine.startsWith('- name:')) {
              const v: PromptVariable = { name: varLine.substring(7).trim(), required: false };
              variables.push(v);
            }
            i++;
          }
          continue;
        }
        i++;
      }
      templateStart = i + 1;
    }

    const template = lines.slice(templateStart).join('\n').trim();
    return { name, version, description, template, tags, variables };
  }

  private normalizePrompt(parsed: Partial<PromptDefinition>): PromptDefinition {
    return {
      name: parsed.name || 'unnamed',
      version: parsed.version || '1.0.0',
      template: parsed.template || '',
      variables: parsed.variables || [],
      category: parsed.category,
      description: parsed.description,
      tags: parsed.tags || [],
      metadata: parsed.metadata,
    };
  }
}
