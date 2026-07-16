import { ChatRequest, ChatResponse, EmbeddingResponse, ProviderHealth } from '../dto/ai.types';

export interface IProvider {
  readonly name: string;
  readonly models: string[];

  chat(request: ChatRequest): Promise<ChatResponse>;
  stream(request: ChatRequest): AsyncIterable<ChatResponse>;
  embed(text: string): Promise<EmbeddingResponse>;
  toolCall(request: ChatRequest): Promise<ChatResponse>;
  health(): Promise<ProviderHealth>;
  countTokens(text: string): Promise<number>;
}
