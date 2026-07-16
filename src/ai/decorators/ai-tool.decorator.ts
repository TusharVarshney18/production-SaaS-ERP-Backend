import { SetMetadata } from '@nestjs/common';
import { AI_TOOL_KEY, ToolDecoratorMetadata } from '../registry/metadata/metadata.service';

export const AITool = (metadata: ToolDecoratorMetadata): ClassDecorator => {
  return SetMetadata(AI_TOOL_KEY, metadata);
};
