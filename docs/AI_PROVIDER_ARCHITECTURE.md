# AI Provider Architecture

## Overview

The Provider Layer abstracts all LLM providers behind a single interface. Business logic never imports OpenAI, Claude, or Gemini SDKs directly — only the `IProvider` interface.

## Provider Interface

```typescript
// src/ai/providers/provider.interface.ts

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface ChatResponse {
  message: ChatMessage;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
  latency: number;
  finishReason: string;
}

interface IProvider {
  readonly name: string;
  readonly models: string[];

  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterable<ChatResponse>;
  embed(text: string): Promise<number[]>;
  isAvailable(): Promise<boolean>;
  estimateCost(usage: { promptTokens: number; completionTokens: number }): number;
}
```

## Provider Factory

```
┌─────────────────────┐
│  ProviderFactory    │
│                     │
│  getProvider()      │────→ Returns IProvider by org config
│  getDefault()       │────→ Returns default provider
│  getByCapability()  │────→ Returns best provider for task
│  getByModel()       │────→ Returns provider for specific model
│  registerProvider() │────→ Registers a new provider
│  getAvailable()     │────→ Returns all healthy providers
└─────────────────────┘
```

### Provider Registration

Providers register themselves via `ProviderFactory.registerProvider()` during `OnModuleInit`:

```typescript
@Module({})
export class AiModule implements OnModuleInit {
  constructor(
    private readonly factory: ProviderFactory,
    private readonly openai: OpenAIProvider,
    private readonly claude: ClaudeProvider,
    private readonly gemini: GeminiProvider,
  ) {}

  onModuleInit() {
    this.factory.registerProvider(this.openai);
    this.factory.registerProvider(this.claude);
    this.factory.registerProvider(this.gemini);
  }
}
```

## Provider Selection Strategy

The `ProviderRouter` selects a provider based on a weighted scoring system:

```
┌────────────────────────────────────────────────────┐
│  ProviderRouter                                    │
│                                                     │
│  Score Provider on:                                 │
│    ├── Capability match (does it support tools?)    │
│    ├── Cost per token (prefer cheaper for simple)   │
│    ├── Latency (prefer faster for chat)             │
│    ├── Organization preference (configured per org) │
│    ├── Agent preference (configured per agent)      │
│    └── Availability (health check)                  │
│                                                     │
│  Return: Highest-scoring available provider         │
└─────────────────────────────────────────────────────┘
```

### Routing Rules

| Scenario | Preferred Provider | Fallback |
|---|---|---|
| Chat conversation | OpenAI GPT-4o | Claude Sonnet → Gemini Pro |
| RAG embedding | OpenAI text-embedding-3-small | — |
| Code generation | Claude Opus | OpenAI GPT-4o |
| Data extraction | Gemini Pro | OpenAI GPT-4o-mini |
| Local development | Ollama (llama3) | — |
| Cost-sensitive | OpenAI GPT-4o-mini | Gemini Flash |
| Enterprise compliance | Azure OpenAI | AWS Bedrock (Claude) |

## Fallback Strategy

```
┌──────────────┐     Fail      ┌──────────────┐    Fail      ┌──────────────┐
│  Primary     │──────────────→│  Secondary   │──────────────→│  Tertiary    │
│  (OpenAI)    │              │  (Claude)    │              │  (Gemini)    │
└──────────────┘              └──────────────┘              └──────────────┘
       │                             │                             │
       │ Success                     │ Success                     │ Success
       ▼                             ▼                             ▼
    Return                      Return                        Return
```

### Fallback Configuration (per org)

```json
{
  "orgId": "org_abc123",
  "providers": {
    "chat": {
      "primary": "openai/gpt-4o",
      "secondary": "claude/claude-sonnet-4",
      "tertiary": "gemini/gemini-pro",
      "fallbackStrategy": "chain" // chain | concurrent | failover
    },
    "embedding": {
      "primary": "openai/text-embedding-3-small",
      "fallbackStrategy": "failover"
    }
  }
}
```

## Supported Providers

### OpenAI

| Property | Value |
|---|---|
| Module | `src/ai/providers/openai/` |
| Models | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o1`, `o3` |
| Embedding | `text-embedding-3-small`, `text-embedding-3-large` |
| Auth | API Key |
| Config | `OPENAI_API_KEY`, `OPENAI_ORG_ID` |

### Gemini (Google)

| Property | Value |
|---|---|
| Module | `src/ai/providers/gemini/` |
| Models | `gemini-pro`, `gemini-ultra`, `gemini-flash` |
| Embedding | `text-embedding-004` |
| Auth | API Key |
| Config | `GEMINI_API_KEY` |

### Claude (Anthropic)

| Property | Value |
|---|---|
| Module | `src/ai/providers/claude/` |
| Models | `claude-opus-4`, `claude-sonnet-4`, `claude-haiku-3` |
| Embedding | N/A (use OpenAI) |
| Auth | API Key |
| Config | `ANTHROPIC_API_KEY` |

### Ollama (Local)

| Property | Value |
|---|---|
| Module | `src/ai/providers/ollama/` |
| Models | `llama3`, `mistral`, `codellama`, `phi` |
| Embedding | `nomic-embed-text` |
| Auth | None |
| Config | `OLLAMA_BASE_URL` (default: localhost:11434) |

### Azure OpenAI

| Property | Value |
|---|---|
| Module | `src/ai/providers/azure-openai/` |
| Models | Same as OpenAI, deployed per org |
| Auth | Azure AD / API Key |
| Config | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY` |

### AWS Bedrock

| Property | Value |
|---|---|
| Module | `src/ai/providers/bedrock/` |
| Models | Claude, Llama, Mistral via Bedrock |
| Auth | AWS IAM |
| Config | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |

## Provider Configuration (YAML)

```yaml
# config/ai.providers.yaml
providers:
  openai:
    enabled: true
    defaultModel: gpt-4o
    models:
      gpt-4o: { maxTokens: 16384, costPer1kInput: 0.0025, costPer1kOutput: 0.01 }
      gpt-4o-mini: { maxTokens: 16384, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 }
      o1: { maxTokens: 32768, costPer1kInput: 0.015, costPer1kOutput: 0.06 }

  claude:
    enabled: true
    defaultModel: claude-sonnet-4
    models:
      claude-sonnet-4: { maxTokens: 8192, costPer1kInput: 0.003, costPer1kOutput: 0.015 }
      claude-haiku-3: { maxTokens: 4096, costPer1kInput: 0.00025, costPer1kOutput: 0.00125 }

  gemini:
    enabled: true
    defaultModel: gemini-pro
    models:
      gemini-pro: { maxTokens: 8192, costPer1kInput: 0.0005, costPer1kOutput: 0.0015 }
      gemini-flash: { maxTokens: 8192, costPer1kInput: 0.000075, costPer1kOutput: 0.0003 }

  ollama:
    enabled: false
    baseUrl: http://localhost:11434
    defaultModel: llama3
```

## Enterprise Provider Selection Matrix

| Factor | Weight | OpenAI | Claude | Gemini | Ollama | Azure | Bedrock |
|---|---|---|---|---|---|---|---|
| Tool Calling | 25% | ✅ Excellent | ✅ Good | ✅ Good | ⚠️ Limited | ✅ Excellent | ✅ Good |
| Reasoning | 20% | ✅ Excellent | ✅ Excellent | ✅ Good | ⚠️ Limited | ✅ Excellent | ✅ Good |
| Speed | 15% | ✅ Fast | ⚠️ Moderate | ✅ Fast | ✅ Fast | ✅ Fast | ⚠️ Moderate |
| Cost | 15% | ⚠️ Moderate | ⚠️ Expensive | ✅ Cheap | ✅ Free | ⚠️ Moderate | ⚠️ Moderate |
| Data Privacy | 15% | ❌ External | ❌ External | ❌ External | ✅ Local | ✅ Azure | ✅ AWS |
| Embedding | 10% | ✅ Excellent | ❌ N/A | ✅ Good | ✅ Basic | ✅ Excellent | ⚠️ Basic |

## Embedding Provider Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  EmbeddingProviderFactory                 │
│                                                            │
│  getEmbedder(task: EmbeddingTask): IEmbeddingProvider     │
│                                                            │
│  Tasks:                                                    │
│    ├── document_indexing  → OpenAI text-embedding-3-large │
│    ├── search_query       → OpenAI text-embedding-3-small │
│    └── local_dev          → Ollama nomic-embed-text       │
└──────────────────────────────────────────────────────────┘
```
