import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base-provider';
import { ChatRequest, ChatResponse, EmbeddingResponse, ProviderConfig } from '../../dto/ai.types';
import { InvalidProviderException } from '../../exceptions/invalid-provider.exception';
import { StreamingException } from '../../exceptions/streaming.exception';

@Injectable()
export class GeminiProvider extends BaseProvider {
  readonly name = 'gemini';
  readonly models = ['gemini-pro', 'gemini-flash'];
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(configService: ConfigService) {
    const config = configService.get<Record<string, ProviderConfig>>('ai.providers');
    const providerConfig = config?.['gemini'] || {
      name: 'gemini',
      enabled: false,
      defaultModel: 'gemini-pro',
      models: {},
    };
    super(providerConfig);
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.validateAvailability();
    const start = Date.now();
    try {
      const model = request.model || this.config.defaultModel;
      const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: this.toGeminiMessages(request.messages),
          generationConfig: {
            temperature: request.temperature,
            maxOutputTokens: request.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new InvalidProviderException(this.name, [
          `Gemini returned ${response.status}: ${errorBody}`,
        ]);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];

      return {
        message: {
          role: 'assistant',
          content: candidate?.content?.parts?.[0]?.text || '',
        },
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0,
        },
        model,
        latency: Date.now() - start,
        finishReason: candidate?.finishReason || 'STOP',
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
      const url = `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: this.toGeminiMessages(request.messages),
          generationConfig: {
            temperature: request.temperature,
            maxOutputTokens: request.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        throw new StreamingException(`Gemini stream error: ${response.statusText}`);
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
              const candidate = data.candidates?.[0];
              yield {
                message: {
                  role: 'assistant',
                  content: candidate?.content?.parts?.[0]?.text || '',
                },
                usage: {
                  promptTokens: 0,
                  completionTokens: 0,
                  totalTokens: 0,
                },
                model,
                latency: 0,
                finishReason: candidate?.finishReason || '',
              };
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

  async embed(text: string): Promise<EmbeddingResponse> {
    this.validateAvailability();
    try {
      const url = `${this.baseUrl}/models/text-embedding-004:embedContent?key=${this.config.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini embedding error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        embedding: data.embedding?.values || [],
        model: 'text-embedding-004',
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
    if (!this.config.apiKey) return false;
    try {
      const url = `${this.baseUrl}/models?key=${this.config.apiKey}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch {
      return false;
    }
  }

  private toGeminiMessages(
    messages: ChatRequest['messages'],
  ): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : msg.role === 'system' ? 'user' : msg.role,
      parts: [{ text: msg.content }],
    }));
  }
}
