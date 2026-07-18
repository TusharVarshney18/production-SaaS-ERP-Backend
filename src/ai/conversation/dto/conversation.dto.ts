export class StartConversationDto {
  organizationId: string;
  userId: string;
  title?: string;
  agentName?: string;
  metadata?: Record<string, unknown>;
}

export class ContinueConversationDto {
  conversationId: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export class ConversationResponseDto {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  status: string;
  messageCount: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
}
