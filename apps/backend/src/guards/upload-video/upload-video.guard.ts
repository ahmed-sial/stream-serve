import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { Kysely } from 'kysely';
import { LRUCache } from 'lru-cache';
import { Database } from 'src/database/database.interface';
import { KYSELY_DB } from 'src/modules/infrastructure/database.module';
import { REDIS_CACHE } from 'src/modules/infrastructure/redis-cache.module';
import type { Request } from 'express';
import {
  hardLockRedisKey,
  PLAN_LRU_TTL,
  planLruKey,
  planRedisKey,
} from 'src/configurations';
import { ICachedPlan } from 'src/types/plan-cache.type';
import { ICachedUsage } from 'src/types/plan-usage-cache.type';
import { PlanTier } from 'src/types/plan-tier.enum';

const planLruCache = new LRUCache<string, ICachedPlan>({
  max: 50_000,
  ttl: PLAN_LRU_TTL,
  updateAgeOnGet: true,
  allowStale: false,
});

const usageLruCache = new LRUCache<string, ICachedUsage>({
  max: 50_000,
  ttl: PLAN_LRU_TTL,
  updateAgeOnGet: true,
  allowStale: false,
});

@Injectable()
export class UploadVideoGuard implements CanActivate {
  constructor(
    @Inject(KYSELY_DB) private readonly db: Kysely<Database>,
    @Inject(REDIS_CACHE) private readonly redis: Redis,
  ) {}

  private async isHardLocked(userId: string): Promise<boolean> {
    return (await this.redis.exists(hardLockRedisKey(userId))) === 1;
  }

  private async resolvePlan(userId: string): Promise<ICachedPlan> {
    const lruValue = planLruCache.get(planLruKey(userId));
    if (lruValue) return lruValue;

    const redisValue = await this.redis.hgetall(planRedisKey(userId));
    // 33:04
  }

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = req.userId;
    if (!userId) throw new UnauthorizedException();

    // Check if user is globally locked(e.g. the limit is exceeded for user's plan) or not
    // If the user is locked, they can't play or upload anything at all.
    if (await this.isHardLocked(userId))
      throw new ForbiddenException(
        'You are currently locked out of platform because of usage beyond limit.',
      );

    return true;
  }
}
