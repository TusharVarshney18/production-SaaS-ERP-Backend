import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base-provider';
import { ChatRequest, ChatResponse, EmbeddingResponse, ProviderConfig } from '../../dto/ai.types';
import { InvalidProviderException } from '../../exceptions/invalid-provider.exception';
import { StreamingException } from '../../exceptions/streaming.exception';

@Injectable()
export class ClaudeProvider extends BaseProvider {
  readonly name = 'claude';
  readonly models = ['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3'];
  private readonly baseUrl = 'https://api.anthropic.com/v1';
  private readonly apiVersion = '2023-06-01';

  constructor(configService: ConfigService) {
    const config = configService.get<Record<string, ProviderConfig>>('ai.providers');
    const providerConfig = config?.['claude'] || {
      name: 'claude',
      enabled: false,
      defaultModel: 'claude-sonnet-4',
      models: {},
    };
    super(providerConfig);
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.validateAvailability();
    const start = Date.now();
    try {
      const model = request.model || this.config.defaultModel;
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey || '',
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model,
          messages: request.messages.map((m) => ({
            role: m.role === 'system' ? 'user' : m.role,
            content: m.content,
          })),
          system: request.messages.find((m) => m.role === 'system')?.content,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new InvalidProviderException(this.name, [
          `Claude returned ${response.status}: ${errorBody}`,
        ]);
      }

      const data = await response.json();
      return {
        message: {
          role: 'assistant',
          content: data.content?.[0]?.text || '',
        },
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
        model,
        latency: Date.now() - start,
        finishReason: data.stop_reason || 'end_turn',
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
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey || '',
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model,
          messages: request.messages.map((m) => ({
            role: m.role === 'system' ? 'user' : m.role,
            content: m.content,
          })),
          system: request.messages.find((m) => m.role === 'system')?.content,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new StreamingException(`Claude stream error: ${response.statusText}`);
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
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content_block_delta') {
                yield {
                  message: { role: 'assistant', content: data.delta?.text || '' },
                  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                  model,
                  latency: 0,
                  finishReason: '',
                };
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      }
    } catch (error) {
      throw error instanceof StreamingException
        ? error
        : new StreamingException((error as Error).message);
    }
  }

  async embed(_text: string): Promise<EmbeddingResponse> {
    throw new InvalidProviderException(this.name, [
      'Claude does not support embeddings. Use OpenAI or Gemini for embeddings.',
    ]);
  }

  async toolCall(request: ChatRequest): Promise<ChatResponse> {
    return this.chat(request);
  }

  async countTokens(text: string): Promise<number> {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  protected async checkAvailability(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'x-api-key': this.config.apiKey || '', 'anthropic-version': this.apiVersion },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
