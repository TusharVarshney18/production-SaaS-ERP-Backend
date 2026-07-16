import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import aiConfig from '../config/ai.config';

describe('AI Configuration', () => {
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forFeature(aiConfig),
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          ignoreEnvVars: true,
        }),
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  it('should have default provider configuration', () => {
    const config = configService.get('ai');
    expect(config).toBeDefined();
    expect(config.defaultProvider).toBeDefined();
    expect(config.temperature).toBeDefined();
    expect(config.timeout).toBeDefined();
    expect(config.retries).toBeDefined();
  });

  it('should have providers defined', () => {
    const config = configService.get('ai');
    expect(config.providers).toBeDefined();
    expect(config.providers.openai).toBeDefined();
    expect(config.providers.gemini).toBeDefined();
    expect(config.providers.claude).toBeDefined();
    expect(config.providers.ollama).toBeDefined();
    expect(config.providers['azure-openai']).toBeDefined();
    expect(config.providers.bedrock).toBeDefined();
  });

  it('should have default models for each provider', () => {
    const config = configService.get('ai');
    expect(config.providers.openai.defaultModel).toBe('gpt-4o');
    expect(config.providers.gemini.defaultModel).toBe('gemini-pro');
    expect(config.providers.claude.defaultModel).toBe('claude-sonnet-4');
    expect(config.providers.ollama.defaultModel).toBe('llama3');
    expect(config.providers['azure-openai'].defaultModel).toBe('gpt-4o');
    expect(config.providers.bedrock.defaultModel).toBe('claude-sonnet-4');
  });

  it('should have model configurations with cost info', () => {
    const config = configService.get('ai');
    const openaiModels = config.providers.openai.models;

    expect(openaiModels['gpt-4o']).toBeDefined();
    expect(openaiModels['gpt-4o'].maxTokens).toBeGreaterThan(0);
    expect(openaiModels['gpt-4o'].costPer1kInput).toBeGreaterThanOrEqual(0);
    expect(openaiModels['gpt-4o'].costPer1kOutput).toBeGreaterThanOrEqual(0);
  });
});
