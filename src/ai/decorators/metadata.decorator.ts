import { SetMetadata } from '@nestjs/common';
import { AI_METADATA_KEY, MetadataDecoratorEntry } from '../registry/metadata/metadata.service';

export const AIMetadata = (key: string, value: unknown): ClassDecorator & MethodDecorator => {
  return (target: object, propertyKey?: string | symbol, descriptor?: unknown) => {
    const existing: MetadataDecoratorEntry[] =
      (Reflect as any).getOwnMetadata(AI_METADATA_KEY, target) || [];
    existing.push({ key, value });
    SetMetadata(AI_METADATA_KEY, existing)(
      target,
      propertyKey as string | symbol,
      descriptor as PropertyDescriptor,
    );
  };
};
