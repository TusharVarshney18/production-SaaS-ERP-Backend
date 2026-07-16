import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base-provider';
import { ChatRequest, ChatResponse, EmbeddingResponse, ProviderConfig } from '../../dto/ai.types';
import { InvalidProviderException } from '../../exceptions/invalid-provider.exception';
import { StreamingException } from '../../exceptions/streaming.exception';

@Injectable()
export class AzureOpenAIProvider extends BaseProvider {
  readonly name = 'azure-openai';
  readonly models = ['gpt-4o', 'gpt-4o-mini'];
  private readonly apiVersion = '2024-02-15-preview';

  constructor(configService: ConfigService) {
    const config = configService.get<Record<string, ProviderConfig>>('ai.providers');
    const providerConfig = config?.['azure-openai'] || {
      name: 'azure-openai',
      enabled: false,
      baseUrl: '',
      defaultModel: 'gpt-4o',
      models: {},
    };
    super(providerConfig);
  }

  get endpoint(): string {
    const base = this.config.baseUrl || '';
    const model = this.config.defaultModel;
    return `${base}/openai/deployments/${model}/chat/completions?api-version=${this.apiVersion}`;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.validateAvailability();
    const start = Date.now();
    try {
      const model = request.model || this.config.defaultModel;
      const endpoint = `${this.config.baseUrl}/openai/deployments/${model}/chat/completions?api-version=${this.apiVersion}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey || '',
        },
        body: JSON.stringify({
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          tools: request.tools,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new InvalidProviderException(this.name, [
          `Azure OpenAI returned ${response.status}: ${errorBody}`,
        ]);
      }

      const data = await response.json();
      const choice = data.choices[0];

      return {
        message: {
          role: choice.message.role,
          content: choice.message.content || '',
          toolCalls: choice.message.tool_calls?.map(
            (tc: { id: string; type: string; function: { name: string; arguments: string } }) => ({
              id: tc.id,
              type: tc.type,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            }),
          ),
        },
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        model,
        latency: Date.now() - start,
        finishReason: choice.finish_reason || 'stop',
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
      const endpoint = `${this.config.baseUrl}/openai/deployments/${model}/chat/completions?api-version=${this.apiVersion}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey || '',
        },
        body: JSON.stringify({
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new StreamingException(`Azure OpenAI stream error: ${response.statusText}`);
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
            const data = line.slice(6);
            if (data === '[DONE]') return;
            try {
              const parsed = JSON.parse(data);
              yield {
                message: { role: 'assistant', content: parsed.choices?.[0]?.delta?.content || '' },
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                model,
                latency: 0,
                finishReason: parsed.choices?.[0]?.finish_reason || '',
              };
            } catch {
              // Skip
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
      const endpoint = `${this.config.baseUrl}/openai/deployments/text-embedding-3-small/embeddings?api-version=${this.apiVersion}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey || '',
        },
        body: JSON.stringify({ input: text }),
      });

      if (!response.ok) {
        throw new Error(`Azure embedding error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        embedding: data.data[0].embedding,
        model: 'text-embedding-3-small',
        usage: {
          promptTokens: data.usage.prompt_tokens,
          totalTokens: data.usage.total_tokens,
        },
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
    if (!this.config.apiKey || !this.config.baseUrl) return false;
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey || '',
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
        signal: AbortSignal.timeout(10000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
