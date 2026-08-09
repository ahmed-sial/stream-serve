import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  addUuidDashes,
  digestApiKey,
  extractApiKeyId,
  isApiKeySyntaxValid,
} from 'src/utils/api-key.utils';
import * as argon2 from 'argon2';
import { LRUCache } from 'lru-cache';
import { REDIS_CACHE } from 'src/modules/redis-cache.module';
import Redis from 'ioredis';
import { KYSELY_DB } from 'src/modules/database.module';
import { Database } from 'src/database/database.interface';
import { Kysely } from 'kysely';
import { LRU_CACHE } from 'src/modules/lru-cache.module';
import { ICacheType } from 'src/types/cache.type';
import type { Request } from 'express';

const CACHE_KEY_VERSION = 'v1';
const LRU_TTL = 5 * 60 * 1000;
const REDIS_TTL = 10 * 60;

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyAuthGuard.name, {
    timestamp: true,
  });
  constructor(
    @Inject(KYSELY_DB) private db: Kysely<Database>,
    @Inject(REDIS_CACHE) private redis: Redis,
    @Inject(LRU_CACHE) private lruCache: LRUCache<string, ICacheType>,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string;
    if (isApiKeySyntaxValid(apiKey)) {
      const apiKeyId = addUuidDashes(extractApiKeyId(apiKey));
      const digestedApiKey = digestApiKey(apiKey);
      const lruKey = `${CACHE_KEY_VERSION}:${apiKeyId}`;
      const now = Date.now();
      try {
        const lruCacheValue = this.lruCache.get(lruKey);
        if (
          lruCacheValue &&
          lruCacheValue.expiresAt > now &&
          lruCacheValue.digestedApiKey === digestedApiKey
        ) {
          request.apiKey = { userId: lruCacheValue.userId, apiKeyId };
          return true;
        }
        const redisKey = `srs:api_key:${CACHE_KEY_VERSION}:${apiKeyId}`;
        const redisCacheValue = await this.redis.hgetall(redisKey);
        if (
          redisCacheValue?.invalid === '1' ||
          redisCacheValue?.digestedApiKey !== digestedApiKey
        )
          throw new UnauthorizedException('Unauthorized');
        if (redisCacheValue?.userId) {
          this.lruCache.set(lruKey, {
            userId: redisCacheValue.userId,
            expiresAt: Date.now() + LRU_TTL,
            digestedApiKey,
          });
          request.apiKey = { userId: redisCacheValue.userId, apiKeyId };
          return true;
        }
        const apiKeyRecord = await this.db
          .selectFrom('api_keys')
          .where('id', '=', apiKeyId)
          .where('revoked_at', 'is', null)
          .select(['hashed_key', 'user_id', 'revoked_at'])
          .executeTakeFirst();
        if (!apiKeyRecord) {
          throw new UnauthorizedException('Unauthorized');
        }
        const isApiKeyValid = await argon2.verify(
          apiKeyRecord.hashed_key,
          apiKey,
        );
        if (!isApiKeyValid) {
          await this.redis.hset(redisKey, {
            invalid: '1',
          });
          await this.redis.expire(redisKey, REDIS_TTL);
          throw new UnauthorizedException('Unauthorized');
        }
        await this.redis.hset(redisKey, {
          userId: apiKeyRecord.user_id,
          digestedApiKey,
        });
        await this.redis.expire(redisKey, REDIS_TTL);
        this.lruCache.set(lruKey, {
          userId: apiKeyRecord.user_id,
          expiresAt: Date.now() + LRU_TTL,
          digestedApiKey,
        });
        request.apiKey = { userId: redisCacheValue.userId, apiKeyId };
        return true;
      } catch (err) {
        this.logger.error(`Authorization error: ${err}`);
        throw new UnauthorizedException('Unauthorized');
      }
    }
    return false;
  }
}
