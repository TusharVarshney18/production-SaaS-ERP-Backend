import { SetMetadata } from '@nestjs/common';
import {
  AI_CAPABILITY_KEY,
  CapabilityDecoratorMetadata,
} from '../registry/metadata/metadata.service';

export const Capability = (
  metadata: CapabilityDecoratorMetadata,
): ClassDecorator & MethodDecorator => {
  return SetMetadata(AI_CAPABILITY_KEY, metadata);
};
