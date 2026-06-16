import { Global, Module } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { CacheKey } from '../common/types/CacheKey.type';

export const LRU_CACHE = 'LRU_CACHE';

@Global()
@Module({
  providers: [
    {
      provide: LRU_CACHE,
      useFactory: () => {
        return new LRUCache<string, CacheKey>({
          ttl: 5 * 60 * 1000,
          max: 10_000,
          updateAgeOnGet: true,
          updateAgeOnHas: false,
          allowStale: false,
        });
      },
    },
  ],
  exports: [LRU_CACHE],
})
export class LRUCacheModule {}
