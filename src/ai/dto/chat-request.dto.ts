import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class ChatRequestDto {
  @ApiProperty({ description: 'Conversation messages' })
  @IsArray()
  messages: ChatMessageDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  tools?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  maxTokens?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  provider?: string;
}

export class ChatMessageDto {
  @ApiProperty({ enum: ['system', 'user', 'assistant', 'tool'] })
  @IsString()
  role: 'system' | 'user' | 'assistant' | 'tool';

  @ApiProperty()
  @IsString()
  content: string;
}
