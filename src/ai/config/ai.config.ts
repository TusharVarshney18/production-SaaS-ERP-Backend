import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'openai',
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  timeout: parseInt(process.env.AI_TIMEOUT || '30000', 10),
  retries: parseInt(process.env.AI_RETRIES || '3', 10),
  streaming: process.env.AI_STREAMING !== 'false',
  providers: {
    openai: {
      name: 'openai',
      enabled: process.env.OPENAI_API_KEY ? true : false,
      apiKey: process.env.OPENAI_API_KEY || '',
      defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o',
      models: {
        'gpt-4o': { maxTokens: 16384, costPer1kInput: 0.0025, costPer1kOutput: 0.01 },
        'gpt-4o-mini': { maxTokens: 16384, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
        'gpt-4-turbo': { maxTokens: 4096, costPer1kInput: 0.01, costPer1kOutput: 0.03 },
      },
    },
    gemini: {
      name: 'gemini',
      enabled: process.env.GEMINI_API_KEY ? true : false,
      apiKey: process.env.GEMINI_API_KEY || '',
      defaultModel: process.env.GEMINI_DEFAULT_MODEL || 'gemini-pro',
      models: {
        'gemini-pro': { maxTokens: 8192, costPer1kInput: 0.0005, costPer1kOutput: 0.0015 },
        'gemini-flash': { maxTokens: 8192, costPer1kInput: 0.000075, costPer1kOutput: 0.0003 },
      },
    },
    claude: {
      name: 'claude',
      enabled: process.env.ANTHROPIC_API_KEY ? true : false,
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      defaultModel: process.env.CLAUDE_DEFAULT_MODEL || 'claude-sonnet-4',
      models: {
        'claude-opus-4': { maxTokens: 4096, costPer1kInput: 0.015, costPer1kOutput: 0.075 },
        'claude-sonnet-4': { maxTokens: 8192, costPer1kInput: 0.003, costPer1kOutput: 0.015 },
        'claude-haiku-3': { maxTokens: 4096, costPer1kInput: 0.00025, costPer1kOutput: 0.00125 },
      },
    },
    ollama: {
      name: 'ollama',
      enabled: process.env.OLLAMA_URL ? true : false,
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3',
      models: {
        llama3: { maxTokens: 4096, costPer1kInput: 0, costPer1kOutput: 0 },
        mistral: { maxTokens: 4096, costPer1kInput: 0, costPer1kOutput: 0 },
        codellama: { maxTokens: 4096, costPer1kInput: 0, costPer1kOutput: 0 },
      },
    },
    'azure-openai': {
      name: 'azure-openai',
      enabled: process.env.AZURE_OPENAI_ENDPOINT ? true : false,
      apiKey: process.env.AZURE_OPENAI_KEY || '',
      baseUrl: process.env.AZURE_OPENAI_ENDPOINT || '',
      defaultModel: process.env.AZURE_OPENAI_DEFAULT_MODEL || 'gpt-4o',
      models: {
        'gpt-4o': { maxTokens: 16384, costPer1kInput: 0.0025, costPer1kOutput: 0.01 },
        'gpt-4o-mini': { maxTokens: 16384, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
      },
    },
    bedrock: {
      name: 'bedrock',
      enabled: process.env.AWS_BEDROCK_REGION ? true : false,
      baseUrl: '',
      defaultModel: process.env.BEDROCK_DEFAULT_MODEL || 'claude-sonnet-4',
      models: {
        'claude-sonnet-4': { maxTokens: 8192, costPer1kInput: 0.003, costPer1kOutput: 0.015 },
        'claude-haiku-3': { maxTokens: 4096, costPer1kInput: 0.00025, costPer1kOutput: 0.00125 },
      },
      options: {
        region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    },
  },
}));
