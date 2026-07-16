import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base-provider';
import { ChatRequest, ChatResponse, EmbeddingResponse, ProviderConfig } from '../../dto/ai.types';
import { InvalidProviderException } from '../../exceptions/invalid-provider.exception';
import { StreamingException } from '../../exceptions/streaming.exception';

@Injectable()
export class BedrockProvider extends BaseProvider {
  readonly name = 'bedrock';
  readonly models = ['claude-sonnet-4', 'claude-haiku-3'];
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;

  constructor(configService: ConfigService) {
    const config = configService.get<Record<string, ProviderConfig>>('ai.providers');
    const providerConfig = config?.['bedrock'] || {
      name: 'bedrock',
      enabled: false,
      defaultModel: 'claude-sonnet-4',
      models: {},
      options: {
        region: 'us-east-1',
        accessKeyId: '',
        secretAccessKey: '',
      },
    };
    super(providerConfig);

    const opts = (providerConfig.options || {}) as Record<string, string>;
    this.region = opts['region'] || 'us-east-1';
    this.accessKeyId = opts['accessKeyId'] || '';
    this.secretAccessKey = opts['secretAccessKey'] || '';
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.validateAvailability();
    const start = Date.now();
    try {
      const model = request.model || this.config.defaultModel;
      const modelId = this.getModelId(model);

      const body = JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: request.maxTokens || 4096,
        messages: request.messages.map((m) => ({
          role: m.role === 'system' ? 'user' : m.role,
          content: m.content,
        })),
        system: request.messages.find((m) => m.role === 'system')?.content,
        temperature: request.temperature,
      });

      const url = `https://bedrock-runtime.${this.region}.amazonaws.com/model/${modelId}/invoke`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessKeyId}:${this.secretAccessKey}`,
        },
        body,
      });

      if (!response.ok) {
        throw new InvalidProviderException(this.name, [
          `Bedrock returned ${response.status}: ${response.statusText}`,
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
      const modelId = this.getModelId(model);
      const url = `https://bedrock-runtime.${this.region}.amazonaws.com/model/${modelId}/invoke-with-response-stream`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessKeyId}:${this.secretAccessKey}`,
        },
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: request.maxTokens || 4096,
          messages: request.messages.map((m) => ({
            role: m.role === 'system' ? 'user' : m.role,
            content: m.content,
          })),
          system: request.messages.find((m) => m.role === 'system')?.content,
          temperature: request.temperature,
        }),
      });

      if (!response.ok) {
        throw new StreamingException(`Bedrock stream error: ${response.statusText}`);
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
              message: { role: 'assistant', content: data.bytes || '' },
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
              model,
              latency: 0,
              finishReason: '',
            };
          } catch {
            // Skip
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
      'Bedrock does not support embeddings directly. Use OpenAI or Gemini.',
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
    if (!this.accessKeyId || !this.secretAccessKey) return false;
    try {
      const url = `https://bedrock.${this.region}.amazonaws.com/models`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { Authorization: `Bearer ${this.accessKeyId}:${this.secretAccessKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private getModelId(model: string): string {
    const modelMap: Record<string, string> = {
      'claude-sonnet-4': 'anthropic.claude-sonnet-4',
      'claude-haiku-3': 'anthropic.claude-haiku-3',
    };
    return modelMap[model] || model;
  }
}
