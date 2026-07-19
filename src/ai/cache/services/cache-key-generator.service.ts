import { Injectable } from '@nestjs/common';
import { ICacheKeyGenerator, CacheKeyParts } from '../interfaces/key-generator.interface';
import { createHash } from 'crypto';

@Injectable()
export class CacheKeyGenerator implements ICacheKeyGenerator {
  generateKey(category: string, organizationId: string, ...parts: string[]): string {
    const hash = this.generateHash(parts.join(':'));
    return `cache:${category}:${organizationId}:${hash}`;
  }

  generateHash(input: string): string {
    return createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  parseKey(key: string): CacheKeyParts | null {
    const parts = key.split(':');
    if (parts.length < 4 || parts[0] !== 'cache') return null;
    return {
      category: parts[1],
      organizationId: parts[2],
      hash: parts.slice(3).join(':'),
      parts: parts.slice(3),
    };
  }
}
