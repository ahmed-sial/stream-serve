export const CACHE_KEY_VERSION = 'v1';
export const LRU_TTL = 5 * 60 * 1000;
export const REDIS_TTL = 10 * 60;
export const LAST_USED_DEBOUNCE_SEC = 60;
export const LAST_USED_HASH_KEY = `srs:api_key:last_used:${CACHE_KEY_VERSION}`;

export const hardLockRedisKey = (userId) => `user:${userId}:locked`;
