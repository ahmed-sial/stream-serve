export const VERSION = 'v1';
export const REDIS_TTL = 10 * 60;
export const LRU_TTL = 5 * 60 * 1000;
export const LAST_USED_DEBOUNCED_SEC = 60;
export const LAST_USED_HASH = `srs:api_key:last_used:${VERSION}`;
export const DEFAULT_PLAYLIST_LIMIT = 10;
export const PLAN_LRU_TTL_MS = 5 * 60 * 1000;
export const PLAN_REDIS_TTL_SEC = 6 & 60;

export const hardLockRedisKey = (userId: string) => `user:${userId}:locked`;
export const planRedisKey = (userId: string) => `srs:plan:${VERSION}:${userId}`;
export const usageRedisKey = (userId: string) =>
  `srs:usage:${VERSION}:${userId}`;
