import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../database/schema';
import { DRIZZLE_DB } from '../database/database.module';
import { and, count, eq } from 'drizzle-orm';
import { apiKeyTable } from '../database/schema';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { LAST_USED_HASH, VERSION } from '../common/types/constants';
import { LRUCache } from 'lru-cache';
import { CachedKey } from '../common/types/cached-key.type';
import { REDIS_CLIENT } from '../infrastructure/redis.module';

const localCache = new LRUCache<string, CachedKey>({ max: 100_000 });

@Injectable()
export class ApiKeyService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NeonHttpDatabase<typeof schema>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  private generateKey(): { plaintextKey: string; keyId: string } {
    const keyId = crypto.randomUUID();
    const secretKey = randomBytes(32).toString('base64');
    const plaintextKey = `${keyId.replace(/-/g, '')}_${secretKey}`;
    return { plaintextKey, keyId };
  }
  async createNewApiKey(userId: string) {
    // Enforce limit of upto 5 API keys
    const [result] = await this.db
      .select({ count: count() })
      .from(apiKeyTable)
      .where(eq(apiKeyTable.userId, userId));
    if (result.count >= 5) {
      throw new BadRequestException(
        'You have reached the limit of 5 API keys.',
      );
    }
    const { plaintextKey, keyId } = this.generateKey();
    // Hash the key to store in DB
    const hashedKey = await argon2.hash(plaintextKey, {
      parallelism: 4,
      memoryCost: 1 << 16,
      type: argon2.argon2id,
      timeCost: 3,
    });
    // Add record in DB
    await this.db
      .insert(apiKeyTable)
      .values({
        id: keyId,
        userId,
        value: hashedKey,
      })
      .returning();
    return { key: plaintextKey };
  }

  async getAllApiKeysForUser(userId: string) {
    return this.db
      .select({
        id: apiKeyTable.id,
        value: apiKeyTable.value,
        createdAt: apiKeyTable.createdAt,
        lastUsedAt: apiKeyTable.lastUsedAt,
        revokedAt: apiKeyTable.revokedAt,
      })
      .from(apiKeyTable)
      .where(eq(apiKeyTable.userId, userId));
  }

  async deleteApiKey(apiId: string, userId: string) {
    await this.db
      .update(apiKeyTable)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeyTable.id, apiId), eq(apiKeyTable.userId, userId)));
    await this.redis.del(`srs:api_key:${VERSION}:${apiId}`);
    localCache.delete(`${VERSION}:${apiId}`);
  }

  async regenerateApiKey(userId: string, apiId: string) {
    const { plaintextKey, keyId } = this.generateKey();
    // Hash the key to store in DB
    const hashedKey = await argon2.hash(plaintextKey, {
      parallelism: 4,
      memoryCost: 1 << 16,
      type: argon2.argon2id,
      timeCost: 3,
    });
    // Invalidate old key caches before update
    await this.redis.del(`srs:api_key:${VERSION}:${apiId}`);
    localCache.delete(`${VERSION}:${apiId}`);
    // Add record in DB
    await this.db
      .update(apiKeyTable)
      .set({ value: hashedKey, id: keyId, createdAt: new Date() })
      .where(and(eq(apiKeyTable.id, apiId), eq(apiKeyTable.userId, userId)));
    return { key: plaintextKey };
  }

  async getApiKeyLastUsedTime(apiId: string, userId: string) {
    const normalizedId = apiId.replace(/-/g, '');
    const val = await this.redis.hget(LAST_USED_HASH, normalizedId);
    if (val) return { lastUsedAt: new Date(Number(val)) };
    // If Redis-Miss then hit the DB to get the value
    const record = await this.db.query.apiKeyTable.findFirst({
      where: (ak) => and(eq(ak.id, apiId), eq(ak.userId, userId)),
      columns: {
        lastUsedAt: true,
      },
    });
    return { lastUsedAt: record?.lastUsedAt ?? null };
  }
}
