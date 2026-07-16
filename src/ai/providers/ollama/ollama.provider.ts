import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base-provider';
import { ChatRequest, ChatResponse, EmbeddingResponse, ProviderConfig } from '../../dto/ai.types';
import { InvalidProviderException } from '../../exceptions/invalid-provider.exception';
import { StreamingException } from '../../exceptions/streaming.exception';

@Injectable()
export class OllamaProvider extends BaseProvider {
  readonly name = 'ollama';
  readonly models = ['llama3', 'mistral', 'codellama'];

  constructor(configService: ConfigService) {
    const config = configService.get<Record<string, ProviderConfig>>('ai.providers');
    const providerConfig = config?.['ollama'] || {
      name: 'ollama',
      enabled: false,
      baseUrl: 'http://localhost:11434',
      defaultModel: 'llama3',
      models: {},
    };
    super(providerConfig);
    if (this.config.baseUrl) {
      this.config.baseUrl = this.config.baseUrl.replace(/\/$/, '');
    }
  }

  get baseUrl(): string {
    return this.config.baseUrl || 'http://localhost:11434';
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.validateAvailability();
    const start = Date.now();
    try {
      const model = request.model || this.config.defaultModel;
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens,
          },
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new InvalidProviderException(this.name, [
          `Ollama returned ${response.status}: ${response.statusText}`,
        ]);
      }

      const data = await response.json();
      return {
        message: {
          role: 'assistant',
          content: data.message?.content || '',
        },
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        model,
        latency: Date.now() - start,
        finishReason: data.done ? 'stop' : 'unknown',
      };
    } catch (error) {
      if (error instanceof InvalidProviderException) throw error;
      this.logger.error(`Chat error: ${(error as Error).message}`);
      throw error;
    }
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatResponse> {
    this.validateAvailability();
    try {
      const model = request.model || this.config.defaultModel;
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens,
          },
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new StreamingException(`Ollama stream error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new StreamingException('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            yield {
              message: { role: 'assistant', content: data.message?.content || '' },
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
              model: data.model || model,
              latency: 0,
              finishReason: data.done ? 'stop' : '',
            };
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (error) {
      throw error instanceof StreamingException
        ? error
        : new StreamingException((error as Error).message);
    }
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    this.validateAvailability();
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text',
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embedding error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        embedding: data.embedding || [],
        model: 'nomic-embed-text',
        usage: { promptTokens: 0, totalTokens: 0 },
      };
    } catch (error) {
      this.logger.error(`Embedding error: ${(error as Error).message}`);
      throw error;
    }
  }

  async toolCall(request: ChatRequest): Promise<ChatResponse> {
    return this.chat(request);
  }

  async countTokens(text: string): Promise<number> {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  protected async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
