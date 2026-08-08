import {
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SuperTokensAuthGuard } from 'supertokens-nestjs';
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
import { SessionRequest } from 'supertokens-node/framework/express';
import Session from 'supertokens-node/recipe/session';
import { RecipeUserId } from 'supertokens-node';
import { LRU_CACHE } from 'src/modules/lru-cache.module';
import { CacheType } from 'src/types/cache.type';

const CACHE_KEY_VERSION = 'v1';
const LRU_TTL = 5 * 60 * 1000;
const REDIS_TTL = 10 * 60;

@Injectable()
export class AuthGuard extends SuperTokensAuthGuard {
  private readonly logger = new Logger(AuthGuard.name, { timestamp: true });
  constructor(
    @Inject(KYSELY_DB) private db: Kysely<Database>,
    @Inject(REDIS_CACHE) private redis: Redis,
    @Inject(LRU_CACHE) private lruCache: LRUCache<string, CacheType>,
  ) {
    super();
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    let isSessionValid = false;
    try {
      isSessionValid = await super.canActivate(context);
      if (isSessionValid) return true;
    } catch (err) {
      const request = context.switchToHttp().getRequest<SessionRequest>();
      const response = context.switchToHttp().getResponse();
      const apiKey = request.headers['x-api-key'] as string;
      const session = await Session.createNewSession(
        request,
        response,
        '',
        new RecipeUserId(''),
      );
      if (isApiKeySyntaxValid(apiKey)) {
        const apiKeyId = addUuidDashes(extractApiKeyId(apiKey));
        const digestedApiKey = digestApiKey(apiKey);
        const lruKey = `${CACHE_KEY_VERSION}:${digestedApiKey}`;
        const now = Date.now();
        try {
          const lruCacheValue = this.lruCache.get(lruKey);
          if (lruCacheValue && lruCacheValue.expiresAt > now) {
            await session.mergeIntoAccessTokenPayload({
              userId: lruCacheValue.userId,
              apiKeyId,
            });
            request.session = session;
            return true;
          }
          const redisKey = `srs:api_key:${CACHE_KEY_VERSION}:${digestedApiKey}`;
          const redisCacheValue = await this.redis.hgetall(redisKey);
          if (redisCacheValue?.invalid === '1')
            throw new UnauthorizedException('Unauthorized');
          if (redisCacheValue?.userId) {
            this.lruCache.set(lruKey, {
              userId: redisCacheValue.userId,
              expiresAt: Date.now() + LRU_TTL,
            });
            await session.mergeIntoAccessTokenPayload({
              userId: redisCacheValue.userId,
              apiKeyId,
            });
            request.session = session;
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
          });
          await this.redis.expire(redisKey, REDIS_TTL);
          this.lruCache.set(lruKey, {
            userId: apiKeyRecord.user_id,
            expiresAt: Date.now() + LRU_TTL,
          });
          await session.mergeIntoAccessTokenPayload({
            userId: apiKeyRecord.user_id,
            apiKeyId,
          });
          request.session = session;
          return true;
        } catch (err) {
          this.logger.error(`Authorization error: ${err}`);
          throw new UnauthorizedException('Unauthorized');
        }
      } else if (isSessionValid) {
        await session.mergeIntoAccessTokenPayload({
          userId: session.getUserId(),
        });
        request.session = session;
        return true;
      }
      throw err;
    }
    return false;
  }
}
