import { SetMetadata } from '@nestjs/common';
import { AI_PERMISSION_KEY } from '../registry/metadata/metadata.service';

export const AIPermission = (...permissions: string[]): ClassDecorator & MethodDecorator => {
  return SetMetadata(AI_PERMISSION_KEY, { permissions });
};
