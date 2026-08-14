import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  ApiKeyAuthGuard,
  CACHE_KEY_VERSION,
  LAST_USED_HASH_KEY,
  REDIS_TTL,
} from './api-key-auth.guard';
import { KYSELY_DB } from 'src/modules/infrastructure/database.module';
import { REDIS_CACHE } from 'src/modules/infrastructure/redis-cache.module';
import { LRU_CACHE } from 'src/modules/infrastructure/lru-cache.module';
import { digestApiKey } from 'src/utils/api-key.utils';
import type { Request } from 'express';

// argon2 does real, slow, native hashing/verification - never let a unit
// test depend on that.
jest.mock('argon2');
const mockedArgon2 = jest.mocked(argon2);

/** Same chainable-builder trick used for the service tests. */
interface DbMock {
  selectFrom: jest.Mock<DbMock, [string]>;
  where: jest.Mock<DbMock, [string, string, unknown]>;
  select: jest.Mock<DbMock, [string[]]>;
  executeTakeFirst: jest.Mock<Promise<unknown>, []>;
}

function createDbMock(): DbMock {
  const builder = {} as DbMock;
  builder.selectFrom = jest.fn<DbMock, [string]>().mockReturnValue(builder);
  builder.where = jest
    .fn<DbMock, [string, string, unknown]>()
    .mockReturnValue(builder);
  builder.select = jest.fn<DbMock, [string[]]>().mockReturnValue(builder);
  builder.executeTakeFirst = jest.fn<Promise<unknown>, []>();
  return builder;
}

// A valid-shaped plaintext key: srs_<32 hex>_<43 base64url chars>, matching
// isApiKeySyntaxValid()'s real (not mocked) rules.
const VALID_API_KEY =
  'srs_' +
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' + // 32 hex chars -> becomes the key id
  '_' +
  'A'.repeat(43); // 43 base64url chars -> the "secret" portion
const API_KEY_ID = 'a1b2c3d4-e5f6-a1b2-c3d4-e5f6a1b2c3d4'; // dashed form
const LRU_KEY = `${CACHE_KEY_VERSION}:${API_KEY_ID}`;
const REDIS_KEY = `srs:api_key:${CACHE_KEY_VERSION}:${API_KEY_ID}`;

function createMockContext(headers: Record<string, string> = {}) {
  const request: Partial<Request> = { headers };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request: request as Request };
}

// Flushes pending microtasks so we can assert on the fire-and-forget
// trackApiKeyLastUsedAt() call, which canActivate() never awaits.
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('ApiKeyAuthGuard', () => {
  let guard: ApiKeyAuthGuard;
  let db: ReturnType<typeof createDbMock>;
  let lruCache: { get: jest.Mock; set: jest.Mock };
  let redis: {
    hgetall: jest.Mock;
    hset: jest.Mock;
    expire: jest.Mock;
    set: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    db = createDbMock();
    lruCache = { get: jest.fn(), set: jest.fn() };
    redis = {
      hgetall: jest.fn().mockResolvedValue({}),
      hset: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'), // debounce lock acquired by default
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyAuthGuard,
        { provide: KYSELY_DB, useValue: db },
        { provide: REDIS_CACHE, useValue: redis },
        { provide: LRU_CACHE, useValue: lruCache },
      ],
    }).compile();

    guard = module.get<ApiKeyAuthGuard>(ApiKeyAuthGuard);
  });

  describe('missing or malformed key', () => {
    it('returns false (no throw) when there is no x-api-key header at all', async () => {
      const { context } = createMockContext({});

      await expect(guard.canActivate(context)).resolves.toBe(false);
      expect(lruCache.get).not.toHaveBeenCalled();
      expect(redis.hgetall).not.toHaveBeenCalled();
      expect(db.selectFrom).not.toHaveBeenCalled();
    });

    it('returns false for a key missing the "srs_" prefix', async () => {
      const { context } = createMockContext({
        'x-api-key': 'wrong_prefix_key',
      });

      await expect(guard.canActivate(context)).resolves.toBe(false);
    });

    it('returns false for a key with the right prefix but the wrong segment lengths', async () => {
      const { context } = createMockContext({
        'x-api-key': 'srs_tooshort_xyz',
      });

      await expect(guard.canActivate(context)).resolves.toBe(false);
    });

    it('returns false for an empty string header', async () => {
      const { context } = createMockContext({ 'x-api-key': '' });

      await expect(guard.canActivate(context)).resolves.toBe(false);
    });
  });

  describe('LRU cache hit (fully warm path)', () => {
    it('authenticates from LRU alone, without ever touching redis or the db', async () => {
      const { context, request } = createMockContext({
        'x-api-key': VALID_API_KEY,
      });
      lruCache.get.mockReturnValueOnce({
        userId: 'user-1',
        expiresAt: Date.now() + 60_000,
        digestedApiKey: digestApiKey(VALID_API_KEY),
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.apiKey).toEqual({
        userId: 'user-1',
        apiKeyId: API_KEY_ID,
      });
      expect(redis.hgetall).not.toHaveBeenCalled();
      expect(db.selectFrom).not.toHaveBeenCalled();
    });

    it('ignores an LRU entry once it has expired and falls through to redis', async () => {
      const { context } = createMockContext({ 'x-api-key': VALID_API_KEY });
      lruCache.get.mockReturnValueOnce({
        userId: 'user-1',
        expiresAt: Date.now() - 1, // already expired
        digestedApiKey: 'irrelevant',
      });
      redis.hgetall.mockResolvedValueOnce({});
      db.executeTakeFirst.mockResolvedValueOnce(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(redis.hgetall).toHaveBeenCalledWith(REDIS_KEY);
    });

    it('ignores an LRU entry whose digest no longer matches the presented key and falls through', async () => {
      const { context } = createMockContext({ 'x-api-key': VALID_API_KEY });
      lruCache.get.mockReturnValueOnce({
        userId: 'user-1',
        expiresAt: Date.now() + 60_000,
        digestedApiKey: 'stale-digest-from-a-different-key',
      });
      redis.hgetall.mockResolvedValueOnce({});
      db.executeTakeFirst.mockResolvedValueOnce(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('redis cache path (LRU miss, redis hit)', () => {
    it('authenticates from redis and repopulates the LRU cache', async () => {
      const { context, request } = createMockContext({
        'x-api-key': VALID_API_KEY,
      });
      lruCache.get.mockReturnValueOnce(undefined);
      redis.hgetall.mockResolvedValueOnce({
        userId: 'user-2',
        digestedApiKey: digestApiKey(VALID_API_KEY),
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.apiKey).toEqual({
        userId: 'user-2',
        apiKeyId: API_KEY_ID,
      });
      expect(lruCache.set).toHaveBeenCalledWith(
        LRU_KEY,
        expect.objectContaining({ userId: 'user-2' }),
      );
      expect(db.selectFrom).not.toHaveBeenCalled();
    });

    it('rejects when redis has flagged this key id as invalid', async () => {
      const { context } = createMockContext({ 'x-api-key': VALID_API_KEY });
      lruCache.get.mockReturnValueOnce(undefined);
      redis.hgetall.mockResolvedValueOnce({ invalid: '1' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      // Should reject immediately - no point hitting the db for a key
      // already known to be bad.
      expect(db.selectFrom).not.toHaveBeenCalled();
    });

    it('rejects when the cached digest belongs to a different key sharing the same id', async () => {
      const { context } = createMockContext({ 'x-api-key': VALID_API_KEY });
      lruCache.get.mockReturnValueOnce(undefined);
      redis.hgetall.mockResolvedValueOnce({
        userId: 'user-2',
        digestedApiKey: 'a-completely-different-digest',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('database verification path (LRU miss, redis miss)', () => {
    beforeEach(() => {
      lruCache.get.mockReturnValue(undefined);
      redis.hgetall.mockResolvedValue({});
    });

    it('rejects when no matching, non-revoked key exists in the database', async () => {
      const { context } = createMockContext({ 'x-api-key': VALID_API_KEY });
      db.executeTakeFirst.mockResolvedValueOnce(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(db.where).toHaveBeenCalledWith('id', '=', API_KEY_ID);
      expect(db.where).toHaveBeenCalledWith('revoked_at', 'is', null);
    });

    it('rejects and flags the key as invalid in redis when the argon2 hash does not match', async () => {
      const { context } = createMockContext({ 'x-api-key': VALID_API_KEY });
      db.executeTakeFirst.mockResolvedValueOnce({
        hashed_key: 'stored-hash',
        user_id: 'user-3',
        revoked_at: null,
      });
      mockedArgon2.verify.mockResolvedValueOnce(false);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(redis.hset).toHaveBeenCalledWith(REDIS_KEY, { invalid: '1' });
      expect(redis.expire).toHaveBeenCalledWith(REDIS_KEY, REDIS_TTL);
    });

    it('authenticates on a valid db-verified key and populates both caches', async () => {
      const { context } = createMockContext({ 'x-api-key': VALID_API_KEY });
      db.executeTakeFirst.mockResolvedValueOnce({
        hashed_key: 'stored-hash',
        user_id: 'user-4',
        revoked_at: null,
      });
      mockedArgon2.verify.mockResolvedValueOnce(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockedArgon2.verify).toHaveBeenCalledWith(
        'stored-hash',
        VALID_API_KEY,
      );
      expect(redis.hset).toHaveBeenCalledWith(
        REDIS_KEY,
        expect.objectContaining({ userId: 'user-4' }),
      );
      expect(redis.expire).toHaveBeenCalledWith(REDIS_KEY, REDIS_TTL);
      expect(lruCache.set).toHaveBeenCalledWith(
        LRU_KEY,
        expect.objectContaining({ userId: 'user-4' }),
      );
    });

    // --- This test previously documented a real bug found while writing
    // this suite: on the cold (db-verification) path, the code read
    //   request.apiKey = { userId: redisCacheValue.userId, apiKeyId };
    // but `redisCacheValue.userId` was guaranteed falsy there - the only
    // way execution reached this branch was because the earlier
    // `if (redisCacheValue?.userId)` check had already failed. It's since
    // been fixed to read `apiKeyRecord.user_id`, matching the redis.hset
    // and lruCache.set calls two lines above it. Kept as a regression test
    // so it can't silently come back.
    it('sets request.apiKey.userId to the verified DB record owner', async () => {
      const { context, request } = createMockContext({
        'x-api-key': VALID_API_KEY,
      });
      db.executeTakeFirst.mockResolvedValueOnce({
        hashed_key: 'stored-hash',
        user_id: 'user-4',
        revoked_at: null,
      });
      mockedArgon2.verify.mockResolvedValueOnce(true);

      await guard.canActivate(context);

      expect(request.apiKey).toEqual({
        userId: 'user-4',
        apiKeyId: API_KEY_ID,
      });
    });

    it('never leaks a revoked key: a revoked row must not satisfy the where clause', async () => {
      // The query already filters `revoked_at is null` at the db level, so
      // a revoked key simply won't be returned by executeTakeFirst() -
      // simulate exactly that (not a record with revoked_at set).
      const { context } = createMockContext({ 'x-api-key': VALID_API_KEY });
      db.executeTakeFirst.mockResolvedValueOnce(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('error handling', () => {
    it('wraps an unexpected downstream error (e.g. db failure) as UnauthorizedException', async () => {
      const { context } = createMockContext({ 'x-api-key': VALID_API_KEY });
      lruCache.get.mockReturnValueOnce(undefined);
      redis.hgetall.mockRejectedValueOnce(new Error('redis unreachable'));

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('does not leak the underlying error message to the caller', async () => {
      const { context } = createMockContext({ 'x-api-key': VALID_API_KEY });
      lruCache.get.mockReturnValueOnce(undefined);
      redis.hgetall.mockRejectedValueOnce(
        new Error('connection string contains a password'),
      );

      const promise = guard.canActivate(context);

      await expect(promise).rejects.toThrow('Unauthorized');
      await expect(promise).rejects.not.toThrow(
        'connection string contains a password',
      );
    });
  });

  describe('trackApiKeyLastUsedAt (fire-and-forget background tracking)', () => {
    it('acquires the debounce lock and writes to the last-used hash on a fresh hit', async () => {
      const { context } = createMockContext({ 'x-api-key': VALID_API_KEY });
      lruCache.get.mockReturnValueOnce({
        userId: 'user-1',
        expiresAt: Date.now() + 60_000,
        digestedApiKey: digestApiKey(VALID_API_KEY),
      });
      redis.set.mockResolvedValueOnce('OK'); // lock acquired

      await guard.canActivate(context);
      await flushPromises();

      expect(redis.set).toHaveBeenCalledWith(
        `srs:api_key:last_used_at_lock:${CACHE_KEY_VERSION}:${API_KEY_ID}`,
        '1',
        'EX',
        60,
        'NX',
      );
      expect(redis.hset).toHaveBeenCalledWith(
        LAST_USED_HASH_KEY,
        API_KEY_ID,
        expect.stringMatching(/^\d+$/),
      );
    });

    it('skips the hash write when the debounce lock is already held (another request tracked it recently)', async () => {
      const { context } = createMockContext({ 'x-api-key': VALID_API_KEY });
      lruCache.get.mockReturnValueOnce({
        userId: 'user-1',
        expiresAt: Date.now() + 60_000,
        digestedApiKey: digestApiKey(VALID_API_KEY),
      });
      redis.set.mockResolvedValueOnce(null); // NX failed - lock already held

      await guard.canActivate(context);
      await flushPromises();

      expect(redis.hset).not.toHaveBeenCalledWith(
        LAST_USED_HASH_KEY,
        expect.anything(),
      );
    });

    // NOTE: `void this.trackApiKeyLastUsedAt(apiKeyId)` in the guard has no
    // `.catch()` anywhere in its chain. If redis.set() or redis.hset()
    // rejects inside it (e.g. connection drop), that becomes a genuine
    // unhandled promise rejection at the process level - not just "silently
    // ignored". Depending on your Node config that can print a scary
    // warning or, on some setups, crash the process outright.
    // This isn't asserted with a test here: any test that actually makes
    // trackApiKeyLastUsedAt() reject reproduces that same unhandled
    // rejection, which then races Jest's own unhandledRejection
    // instrumentation and unpredictably fails whichever test happens to be
    // running when Node reports it (including a later, unrelated test) -
    // not worth that flakiness for a beginner test suite. The fix is a
    // one-liner in the guard:
    //   void this.trackApiKeyLastUsedAt(apiKeyId).catch((err) =>
    //     this.logger.error(`Failed to track API key usage: ${err}`),
    //   );

    // --- Bug #2 from the earlier review (see LAST_USED_HASH_KEY usage in
    // api-key-last-used-at.cron.ts) has been fixed here. ---
    // The cron job reads this hash with `hgetall` and expects each FIELD
    // NAME to be an api key id and each VALUE to be its timestamp
    // (`Object.entries(map)` is destructured as `[apiKeyId, lastUsedAt]`).
    // trackApiKeyLastUsedAt() now correctly calls
    // `hset(LAST_USED_HASH_KEY, apiKeyId, timestamp)` - a real 3-argument
    // field/value write - instead of the old object-shorthand call that
    // clobbered two fixed fields on every single key. This test locks that
    // contract in place, and proves the written value actually round-trips
    // the way the cron job's flush needs it to.
    it('writes a hash field keyed by the real api key id, matching what the cron job flush expects', async () => {
      const { context } = createMockContext({ 'x-api-key': VALID_API_KEY });
      lruCache.get.mockReturnValueOnce({
        userId: 'user-1',
        expiresAt: Date.now() + 60_000,
        digestedApiKey: digestApiKey(VALID_API_KEY),
      });

      await guard.canActivate(context);
      await flushPromises();

      expect(redis.hset).toHaveBeenCalledWith(
        LAST_USED_HASH_KEY,
        API_KEY_ID,
        expect.stringMatching(/^\d+$/),
      );

      // Mirror exactly what the cron job's `Object.entries(await hgetall(...))`
      // step does with this call's arguments, to prove it actually parses
      // into a valid timestamp rather than just matching a regex.
      const [, field, value] = redis.hset.mock.calls[0] as [
        string,
        string,
        string,
      ];
      expect(field).toBe(API_KEY_ID);
      expect(Number.isNaN(new Date(Number(value)).getTime())).toBe(false);
    });
  });
});
