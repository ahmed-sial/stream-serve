import { Inject, Injectable } from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../database/schema';
import { DRIZZLE_DB } from '../database/database.module';
import { REDIS_CLIENT } from '../infrastructure/redis.module';
import Redis from 'ioredis';
import { Cron } from '@nestjs/schedule';
import { LAST_USED_HASH } from '../common/types/constants';
import { sql } from 'drizzle-orm';

@Injectable()
export class ApiKeyLastUsedCron {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NeonHttpDatabase<typeof schema>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  @Cron('*/5 * * * *')
  async flushLastUsed() {
    const tempKey = `${LAST_USED_HASH}:tmp:${Date.now()}`;
    const renamed = await this.redis.rename(LAST_USED_HASH, tempKey);
    if (!renamed) return; // Hash doesn't exist
    const map = await this.redis.hgetall(tempKey);
    if (!map || Object.keys(map).length === 0) return;
    // Defer deletion until after successful DB write
    const entries = Object.entries(map)
      .map(([keyId, ts]) => ({
        keyId,
        ts: new Date(Number(ts)),
      }))
      .filter(
        (x) =>
          x.keyId &&
          x.ts instanceof Date &&
          !Number.isNaN(Number(x.ts.getTime())),
      );

    if (entries.length === 0) return;
    const valuesSql = sql.join(
      entries.map((e) => sql`(${e.keyId}, ${e.ts})`),
      sql`,`,
    );
    await this.db.execute(sql`
    UPDATE api_key AS ak
    SET last_used_at = v.ts
    FROM (VALUES ${valuesSql} AS v(id, ts))
    WHERE ak.id = v.id
`);
    await this.redis.del(tempKey);
  }
}
