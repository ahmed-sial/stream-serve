import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Redis from 'ioredis';
import { Kysely, sql } from 'kysely';
import { Database } from 'src/database/database.interface';
import { LAST_USED_HASH_KEY } from 'src/guards/api-key-auth/api-key-auth.guard';
import { KYSELY_DB } from 'src/modules/infrastructure/database.module';
import { REDIS_CACHE } from 'src/modules/infrastructure/redis-cache.module';

@Injectable()
export class ApiKeyUsageCronJob {
  private readonly logger = new Logger(ApiKeyUsageCronJob.name, {
    timestamp: true,
  });
  constructor(
    @Inject(KYSELY_DB) private readonly db: Kysely<Database>,
    @Inject(REDIS_CACHE) private readonly redis: Redis,
  ) {}

  @Cron('*/5 * * * *')
  async flushLastUsedAt() {
    const flushKey = `${LAST_USED_HASH_KEY}:flush:${crypto.randomUUID()}`;

    // Atomically move the current batch out of the active hash.
    const renamed = await this.redis
      .rename(LAST_USED_HASH_KEY, flushKey)
      .catch(() => null);

    // If the active key doesn't exist, there is nothing to flush.
    if (renamed === null) return;

    try {
      const map = await this.redis.hgetall(flushKey);

      if (Object.keys(map).length === 0) {
        await this.redis.del(flushKey);
        return;
      }

      const entries = Object.entries(map)
        .map(([apiKeyId, lastUsedAt]) => ({
          apiKeyId,
          lastUsedAt: new Date(Number(lastUsedAt)),
        }))
        .filter(
          ({ apiKeyId, lastUsedAt }) =>
            apiKeyId && !Number.isNaN(lastUsedAt.getTime()),
        );

      if (entries.length === 0) {
        await this.redis.del(flushKey);
        return;
      }

      const values = sql.join(
        entries.map(
          ({ apiKeyId, lastUsedAt }) =>
            sql`(${apiKeyId}::uuid, ${lastUsedAt}::timestamptz)`,
        ),
        sql`,`,
      );

      await sql`
        UPDATE api_key AS ak
        SET last_used_at = v.last_used_at
        FROM (
          VALUES ${values}
        ) AS v(id, last_used_at)
        WHERE ak.id = v.id
      `.execute(this.db);

      await this.redis.del(flushKey);
    } catch (error) {
      this.logger.error(
        'Failed to flush API key usage',
        error instanceof Error ? error.stack : String(error),
      );
      // Don't delete flushKey if PostgreSQL failed.
      // It can be retried.
      throw error;
    }
  }
}
