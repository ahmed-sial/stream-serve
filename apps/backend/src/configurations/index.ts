import { PlanTier } from 'src/types/plan-tier.enum';

export const CACHE_KEY_VERSION = 'v1';
export const API_KEY_LRU_TTL = 5 * 60 * 1000;
export const API_KEY_REDIS_TTL = 10 * 60;
export const API_KEY_LAST_USED_DEBOUNCE_SEC = 60;
export const API_KEY_LAST_USED_HASH_KEY = `srs:api_key:last_used:${CACHE_KEY_VERSION}`;

export const PLAN_LRU_TTL = 5 * 60 * 1000;
export const PLAN_REDIS_TTL = 6 * 60;
export const hardLockRedisKey = (userId) =>
  `srs:hard_locked:${CACHE_KEY_VERSION}:${userId}`;
export const planLruKey = (userId) => `plan:${CACHE_KEY_VERSION}:${userId}`;
export const planRedisKey = (userId) =>
  `srs:plan:${CACHE_KEY_VERSION}:${userId}`;
export const usageRedisKey = (userId: string) =>
  `srs:usage:${CACHE_KEY_VERSION}:${userId}`;

const GB = 1024 ** 3;
const TB = 1024 ** 4;
export const PLAN_DEFAULTS: Record<
  PlanTier,
  { storageLimit: number; streamedMinutesLimit: number }
> = {
  [PlanTier.FREE]: { storageLimit: 5 * GB, streamedMinutesLimit: 1_000 },
  [PlanTier.STARTER]: { storageLimit: 255 * GB, streamedMinutesLimit: 10_000 },
  [PlanTier.PRO]: { storageLimit: 600 * GB, streamedMinutesLimit: 22_000 },
  [PlanTier.BUSINESS]: { storageLimit: 2 * TB, streamedMinutesLimit: 50_000 },
};
