import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base-provider';
import { ChatRequest, ChatResponse, EmbeddingResponse, ProviderConfig } from '../../dto/ai.types';
import { InvalidProviderException } from '../../exceptions/invalid-provider.exception';
import { StreamingException } from '../../exceptions/streaming.exception';

@Injectable()
export class OpenAIProvider extends BaseProvider {
  readonly name = 'openai';
  readonly models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];

  constructor(configService: ConfigService) {
    const config = configService.get<Record<string, ProviderConfig>>('ai.providers');
    const providerConfig = config?.['openai'] || {
      name: 'openai',
      enabled: false,
      defaultModel: 'gpt-4o',
      models: {},
    };
    super(providerConfig);
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.validateAvailability();
    try {
      const response = await this.callOpenAI(request);
      return response;
    } catch (error) {
      this.logger.error(`Chat error: ${(error as Error).message}`);
      throw error;
    }
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatResponse> {
    this.validateAvailability();
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model || this.config.defaultModel,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new StreamingException(`OpenAI API error: ${response.statusText}`, {
          status: response.status,
        });
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new StreamingException('No response body for streaming');
      }

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
                message: {
                  role: 'assistant',
                  content: parsed.choices?.[0]?.delta?.content || '',
                },
                usage: {
                  promptTokens: 0,
                  completionTokens: 0,
                  totalTokens: 0,
                },
                model: parsed.model || this.config.defaultModel,
                latency: 0,
                finishReason: parsed.choices?.[0]?.finish_reason || '',
              };
            } catch {
              // Skip malformed lines
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Stream error: ${(error as Error).message}`);
      throw error instanceof StreamingException
        ? error
        : new StreamingException((error as Error).message);
    }
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    this.validateAvailability();
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.statusText}`);
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
    this.validateAvailability();
    try {
      const response = await this.callOpenAI(request);
      return response;
    } catch (error) {
      this.logger.error(`Tool call error: ${(error as Error).message}`);
      throw error;
    }
  }

  async countTokens(text: string): Promise<number> {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  protected async checkAvailability(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async callOpenAI(request: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || this.config.defaultModel,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new InvalidProviderException(
        this.name,
        [`OpenAI returned ${response.status}: ${response.statusText}`, errorBody].filter(Boolean),
      );
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
      model: data.model,
      latency: Date.now() - start,
      finishReason: choice.finish_reason || 'stop',
    };
  }
}
