import { SetMetadata } from '@nestjs/common';
import { AI_PROVIDER_SUPPORT_KEY } from '../registry/metadata/metadata.service';

export const ProviderSupport = (...providers: string[]): ClassDecorator & MethodDecorator => {
  return SetMetadata(AI_PROVIDER_SUPPORT_KEY, providers);
};
