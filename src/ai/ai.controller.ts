import { Body, Controller, Get, Param, Post, Query, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AIGatewayService } from './core/ai-gateway.service';
import { AIHealthService } from './health/ai-health.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { HealthResponseDto } from './dto/health-response.dto';
import { ProviderFactory } from './providers/provider.factory';

@ApiTags('AI')
@ApiBearerAuth()
@Controller({ path: 'ai', version: VERSION_NEUTRAL })
export class AIController {
  constructor(
    private readonly gateway: AIGatewayService,
    private readonly healthService: AIHealthService,
    private readonly factory: ProviderFactory,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Send a chat message to the AI' })
  async chat(@Body() request: ChatRequestDto): Promise<ChatResponseDto> {
    const response = await this.gateway.chat({
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      model: request.model,
      stream: false,
    });

    return response;
  }

  @Post('chat/:provider')
  @ApiOperation({ summary: 'Send a chat message using a specific provider' })
  async chatWithProvider(
    @Param('provider') provider: string,
    @Body() request: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    const response = await this.gateway.chat(
      {
        messages: request.messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        model: request.model,
        stream: false,
      },
      { preferredProvider: provider },
    );

    return response;
  }

  @Get('health')
  @ApiOperation({ summary: 'Check AI platform health' })
  async health(): Promise<HealthResponseDto> {
    const result = await this.healthService.check();
    return result;
  }

  @Get('providers')
  @ApiOperation({ summary: 'List registered providers' })
  listProviders(): { providers: string[]; count: number } {
    return {
      providers: this.factory.getRegisteredProviders(),
      count: this.factory.getProviderCount(),
    };
  }

  @Post('providers/:name/check')
  @ApiOperation({ summary: 'Check health of a specific provider' })
  async checkProvider(@Param('name') name: string) {
    const health = await this.healthService.providerHealth(name);
    return health || { error: `Provider "${name}" not found` };
  }

  @Post('embed')
  @ApiOperation({ summary: 'Generate embeddings for text' })
  @ApiQuery({ name: 'text', required: true })
  async embed(@Query('text') text: string) {
    return this.gateway.embed(text);
  }
}
