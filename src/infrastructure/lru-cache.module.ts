import { Global, Module } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { CachedKey } from 'src/common/types/cached-key.type';

export const LRU_CACHE = 'LRU_CACHE';

@Global()
@Module({
  providers: [
    {
      provide: LRU_CACHE,
      useFactory: () => {
        return new LRUCache<string, CachedKey>({
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
