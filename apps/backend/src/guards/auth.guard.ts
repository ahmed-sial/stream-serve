import {
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SuperTokensAuthGuard } from 'supertokens-nestjs';
import {
  digestApiKey,
  extractApiKeyId,
  isApiKeySyntaxValid,
} from 'src/utils/api-key.utils';
import * as argon2 from 'argon2';
import { LRUCache } from 'lru-cache';
import { SessionContainer } from 'supertokens-node/recipe/session';
import { REDIS_CACHE } from 'src/modules/redis-cache.module';
import Redis from 'ioredis';
import { KYSELY_DB } from 'src/modules/database.module';
import { Database } from 'src/database/database.interface';
import { Kysely } from 'kysely';

interface CachedKey {
  userId: string;
  expiresAt: number;
}

const CACHE_KEY_VERSION = 'v1';
const LRU_TTL = 5 * 60 * 1000;
const REDIS_TTL = 10 * 60;
const lruCache = new LRUCache<string, CachedKey>({ max: 10000 });

@Injectable()
export class AuthGuard extends SuperTokensAuthGuard {
  private readonly logger = new Logger(AuthGuard.name, { timestamp: true });
  constructor(
    @Inject(KYSELY_DB) private db: Kysely<Database>,
    @Inject(REDIS_CACHE) private redis: Redis,
  ) {
    super();
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isSessionValid = await super.canActivate(context);
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['X-Api-Key'] as string;
    const session = request.session as SessionContainer;
    if (isApiKeySyntaxValid(apiKey)) {
      const apiKeyId = extractApiKeyId(apiKey);
      const digestedApiKey = digestApiKey(apiKey);
      const lruKey = `${CACHE_KEY_VERSION}:${digestedApiKey}`;
      const now = Date.now();
      try {
        const lruCacheValue = lruCache.get(lruKey);
        if (lruCacheValue && lruCacheValue.expiresAt > now) {
          await session.mergeIntoAccessTokenPayload({
            userId: lruCacheValue.userId,
            apiKeyId,
          });
          return true;
        }
        const redisKey = `srs:api_key:${CACHE_KEY_VERSION}:${digestedApiKey}`;
        const redisCacheValue = await this.redis.hgetall(redisKey);
        if (redisCacheValue?.invalid === '1')
          throw new UnauthorizedException('Unauthorized');
        if (redisCacheValue?.userId) {
          lruCache.set(lruKey, {
            userId: redisCacheValue.userId,
            expiresAt: Date.now() + LRU_TTL,
          });
          await session.mergeIntoAccessTokenPayload({
            userId: redisCacheValue.userId,
            apiKeyId,
          });
          return true;
        }
        const apiKeyRecord = await this.db
          .selectFrom('api_keys')
          .where('id', '=', apiKeyId)
          .where('revoked_at', '=', null)
          .select(['hashed_key', 'user_id', 'revoked_at'])
          .executeTakeFirst();

        if (!apiKeyRecord) {
          throw new UnauthorizedException('Unauthorized');
        }
        const isApiKeyValid = argon2.verify(apiKeyRecord.hashed_key, apiKey);
        if (!isApiKeyValid) {
          await this.redis.hset(redisKey, {
            invalid: '1',
          });
          await this.redis.expire(redisKey, REDIS_TTL);
          throw new UnauthorizedException('Unauthorized');
        }
        await this.redis.hset(redisKey, {
          userId: apiKeyRecord.user_id,
        });
        await this.redis.expire(redisKey, REDIS_TTL);
        await session.mergeIntoAccessTokenPayload({
          userId: apiKeyRecord.user_id,
          apiKeyId,
        });
        return true;
      } catch (err) {
        this.logger.error(`Authorization error: ${err}`);
        throw new UnauthorizedException('Unauthorized');
      }
    } else if (isSessionValid) {
      await session.mergeIntoAccessTokenPayload({
        userId: session.getUserId(),
      });
      return true;
    }
    return false;
  }
}
