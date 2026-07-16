import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIController } from './ai.controller';
import { AIGatewayService } from './core/ai-gateway.service';
import { ProviderRouterService } from './core/provider-router.service';
import { ProviderFactory } from './providers/provider.factory';
import { OpenAIProvider } from './providers/openai/openai.provider';
import { GeminiProvider } from './providers/gemini/gemini.provider';
import { ClaudeProvider } from './providers/claude/claude.provider';
import { OllamaProvider } from './providers/ollama/ollama.provider';
import { AzureOpenAIProvider } from './providers/azure-openai/azure-openai.provider';
import { BedrockProvider } from './providers/bedrock/bedrock.provider';
import { AIHealthService } from './health/ai-health.service';
import aiConfig from './config/ai.config';

@Module({
  imports: [ConfigModule.forFeature(aiConfig)],
  controllers: [AIController],
  providers: [
    ProviderFactory,
    ProviderRouterService,
    AIGatewayService,
    AIHealthService,
    OpenAIProvider,
    GeminiProvider,
    ClaudeProvider,
    OllamaProvider,
    AzureOpenAIProvider,
    BedrockProvider,
  ],
  exports: [AIGatewayService, ProviderRouterService, ProviderFactory, AIHealthService],
})
export class AiModule implements OnModuleInit {
  constructor(
    private readonly factory: ProviderFactory,
    private readonly openai: OpenAIProvider,
    private readonly gemini: GeminiProvider,
    private readonly claude: ClaudeProvider,
    private readonly ollama: OllamaProvider,
    private readonly azureOpenAI: AzureOpenAIProvider,
    private readonly bedrock: BedrockProvider,
  ) {}

  onModuleInit() {
    this.factory.registerProvider(this.openai);
    this.factory.registerProvider(this.gemini);
    this.factory.registerProvider(this.claude);
    this.factory.registerProvider(this.ollama);
    this.factory.registerProvider(this.azureOpenAI);
    this.factory.registerProvider(this.bedrock);
  }
}
