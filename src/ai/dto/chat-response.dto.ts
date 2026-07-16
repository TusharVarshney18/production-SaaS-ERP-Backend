import { ApiProperty } from '@nestjs/swagger';

export class ChatResponseDto {
  @ApiProperty()
  message: {
    role: string;
    content: string;
    toolCalls?: Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }>;
  };

  @ApiProperty()
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  @ApiProperty()
  model: string;

  @ApiProperty()
  latency: number;

  @ApiProperty()
  finishReason: string;
}
