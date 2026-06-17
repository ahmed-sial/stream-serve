import { LRUCache } from 'lru-cache';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../database/schema';
import { DRIZZLE_DB } from '../database/database.module';
import { REDIS_CLIENT } from '../infrastructure/redis.module';
import Redis from 'ioredis';
import type { Request } from 'express';
import { verifyToken } from '@clerk/backend';
import { extractApiKeyId } from '../utils/api-key-verifier';
import { digestApiKey } from '../utils/api-key-digestor';
import { and, eq, isNull } from 'drizzle-orm';
import * as argon2 from 'argon2';
import {
  LAST_USED_DEBOUNCED_SEC,
  LAST_USED_HASH,
  LRU_TTL,
  REDIS_TTL,
  VERSION,
} from '../common/types/constants';
import { CachedKey } from '../common/types/cached-key.type';
import { LRU_CACHE } from 'src/infrastructure/lru-cache.module';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NeonHttpDatabase<typeof schema>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    @Inject(LRU_CACHE)
    private readonly localCache: LRUCache<string, CachedKey>,
  ) {}

  private async trackApiKeyLastUsed(keyId: string) {
    const lockKey = `srs:api_key:last_used_lock:${VERSION}:${keyId}`;
    const ok = await this.redis.set(
      lockKey,
      '1',
      'EX',
      LAST_USED_DEBOUNCED_SEC,
      'NX',
    );
    if (!ok) return;
    /// There is no TTL for LAST_USED_HASH, it will be deleted by cron job after saving the last_used_at to DB
    await this.redis.hset(LAST_USED_HASH, keyId, Date.now().toString());
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string;
    if (apiKey) {
      const apiKeyId = extractApiKeyId(apiKey);
      if (!apiKeyId)
        throw new UnauthorizedException('Malformed API key provided.');
      const digestedApiKey = digestApiKey(apiKey);
      const lruKey = `${VERSION}:${apiKeyId}`;
      try {
        // If the value is in local cache
        const c = this.localCache.get(lruKey);
        if (
          c &&
          c.expiresAt > Date.now() &&
          c.apiKeyDigest === digestedApiKey
        ) {
          request.user = {
            id: c.userId,
            keyId: apiKeyId,
          };
          void this.trackApiKeyLastUsed(apiKeyId);
          return true;
        }
        const redisKeyDigest = `srs:api_key:${VERSION}:${apiKeyId}`;
        const r = await this.redis.hgetall(redisKeyDigest);
        if (r?.invalid === '1') throw new UnauthorizedException('Unauthorized');
        if (r?.apiKeyDigest && r?.apiKeyDigest !== digestedApiKey)
          throw new UnauthorizedException('Unauthorized');

        if (r?.userId) {
          this.localCache.set(lruKey, {
            userId: r.userId,
            apiKeyDigest: digestedApiKey,
            expiresAt: Date.now() + LRU_TTL,
          });
          request.user = {
            id: r.userId,
            keyId: apiKeyId,
          };
          void this.trackApiKeyLastUsed(apiKeyId);
          return true;
        }
        const record = await this.db.query.apiKeyTable.findFirst({
          where: (apikey) =>
            and(eq(apikey.id, apiKeyId), isNull(apikey.revokedAt)),
          columns: {
            value: true,
            userId: true,
            revokedAt: true,
          },
        });
        if (!record)
          throw new UnauthorizedException('Invalid API key provided.');
        const isValid = await argon2.verify(record.value, apiKey);
        if (!isValid) {
          // If any new request comes from same API, it is blocked
          await this.redis.hset(redisKeyDigest, {
            invalid: '1',
          });
          await this.redis.expire(redisKeyDigest, REDIS_TTL); // TODO: Why setting the key to expire?
          throw new UnauthorizedException('Unauthorized');
        }
        await this.redis.hset(redisKeyDigest, {
          userId: record.userId,
          apiKeyDigest: digestedApiKey,
        });

        await this.redis.expire(redisKeyDigest, REDIS_TTL);
        request.user = {
          id: record.userId,
          keyId: apiKeyId,
        };
        void this.trackApiKeyLastUsed(apiKeyId);
        return true;
      } catch (error) {
        console.error('Error occurred: ' + error);
        throw new UnauthorizedException('Unauthorized');
      }
    } else {
      // If there is no api key then it is a normal login by user with JWT token by clerk
      const token = request.headers.authorization?.split(' ')[1];
      if (!token) throw new UnauthorizedException('Token missing in request.');
      try {
        const verifiedToken = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        request.user = {
          id: verifiedToken.sub,
          ...verifiedToken,
        };
        return true;
      } catch (error) {
        console.error('Error occurred: ' + error);
        throw new UnauthorizedException(
          'An unexpected error occurred. Please try again later.',
        );
      }
    }
  }
}
