import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Kysely } from 'kysely';
import { Database } from 'src/database/database.interface';
import { KYSELY_DB } from 'src/modules/database.module';
import * as argon2 from 'argon2';
import { LRU_CACHE } from 'src/modules/lru-cache.module';
import { LRUCache } from 'lru-cache';
import { ICacheType } from 'src/types/cache.type';
import { REDIS_CACHE } from 'src/modules/redis-cache.module';
import Redis from 'ioredis';
import {
  CACHE_KEY_VERSION,
  LAST_USED_HASH_KEY,
} from 'src/guards/api-key-auth.guard';

@Injectable()
export class ApiKeyService {
  constructor(
    @Inject(KYSELY_DB) private readonly db: Kysely<Database>,
    @Inject(LRU_CACHE) private readonly lruCache: LRUCache<string, ICacheType>,
    @Inject(REDIS_CACHE) private readonly redis: Redis,
  ) {}

  private generateApiKey(): { plainTextKey: string; keyId: string } {
    const keyId = crypto.randomUUID().replace(/-/g, '');
    const secretKey = randomBytes(32).toString('base64url');
    const plainTextKey = `srs_${keyId}_${secretKey}`;
    return { plainTextKey, keyId };
  }

  async createApiKey(userId: string, apiKeyName: string) {
    const [result] = await this.db
      .selectFrom('api_keys')
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .select(({ fn }) => [fn.count<number>('id').as('api_count')])
      .execute();

    if (result.api_count >= 5)
      throw new BadRequestException(
        'You have reached the maximum limit of 5 API keys.',
      );

    const { keyId, plainTextKey } = this.generateApiKey();
    const hashedKey = await argon2.hash(plainTextKey, {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 1 << 16,
      parallelism: 1,
    });
    const prefix = plainTextKey.substring(0, 10) + '...';
    await this.db
      .insertInto('api_keys')
      .values({
        id: keyId,
        prefix,
        api_name: apiKeyName,
        user_id: userId,
        hashed_key: hashedKey,
      })
      .executeTakeFirst();
    return { apiKey: plainTextKey };
  }

  async getAllApiKeys(userId: string) {
    const apiKeys = await this.db
      .selectFrom('api_keys')
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .select([
        'id',
        'api_name',
        'prefix',
        'created_at',
        'last_used_at',
        'revoked_at',
      ])
      .execute();
    return { apiKeys };
  }

  async deleteApiKey(userId: string, apiKeyId: string) {
    const record = await this.db
      .selectFrom('api_keys')
      .select(['revoked_at'])
      .where('user_id', '=', userId)
      .where('id', '=', apiKeyId)
      .executeTakeFirstOrThrow(
        () => new BadRequestException('API key not found'),
      );
    if (record.revoked_at)
      throw new BadRequestException('Bad Request. Try a valid API key');
    const result = await this.db
      .updateTable('api_keys')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', userId)
      .where('id', '=', apiKeyId)
      .executeTakeFirst();
    if (result.numUpdatedRows !== BigInt(1)) {
      throw new InternalServerErrorException(
        'Unable to delete API key. Try again later',
      );
    }
    const lruKey = `${CACHE_KEY_VERSION}:${apiKeyId}`;
    this.lruCache.delete(lruKey);
    const redisKey = `srs:api_key:${CACHE_KEY_VERSION}:${apiKeyId}`;
    await this.redis.del(redisKey);
  }

  async getApiKeyLastUsedAtTimestamp(userId: string, apiKeyId: string) {
    const ownership = await this.db
      .selectFrom('api_keys')
      .select(['id'])
      .where('id', '=', apiKeyId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!ownership) return null;

    // Access redis after ownership has been confirmed
    const normalizedKey = apiKeyId.replace(/-/g, '');
    const value = await this.redis.hget(LAST_USED_HASH_KEY, normalizedKey);
    if (value) return { lastUsedAt: new Date(Number(value)) };

    // redis miss - hit db
    const result = await this.db
      .selectFrom('api_keys')
      .select(['last_used_at'])
      .where('id', '=', apiKeyId)
      .executeTakeFirst();
    return { lastUsedAt: result?.last_used_at ?? null };
  }
}
