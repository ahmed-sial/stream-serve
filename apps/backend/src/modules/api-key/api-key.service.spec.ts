import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { KYSELY_DB } from 'src/modules/infrastructure/database.module';
import { LRU_CACHE } from 'src/modules/infrastructure/lru-cache.module';
import { REDIS_CACHE } from 'src/modules/infrastructure/redis-cache.module';
import { CACHE_KEY_VERSION } from 'src/guards/api-key-auth.guard';
import { ApiKeyService } from './api-key.service';

// argon2 does real, slow, native hashing. We never want a unit test to
// depend on that (or on its actual output), so we replace the whole
// module with jest.fn()s and control what it returns per test.
jest.mock('argon2');
const mockedArgon2 = jest.mocked(argon2);

/**
 * Kysely's query builder is *chainable*: `db.selectFrom(...).where(...).select(...).execute()`.
 * To fake that with jest we make every "chain" method return the same
 * mock object (`this`), and only the terminal methods
 * (execute / executeTakeFirst / executeTakeFirstOrThrow) are real
 * jest.fn()s whose resolved/rejected value we set per test.
 *
 * Each method is given a concrete jest.fn<ReturnType, Args> generic
 * (instead of a bare `jest.fn()`) so that reading back `.mock.calls[...]`
 * later comes back typed instead of `any` - that's what keeps the
 * project's `no-unsafe-*` eslint rules happy.
 *
 * We rebuild this from scratch in beforeEach so no state (call counts,
 * queued mockResolvedValueOnce calls) leaks between tests.
 */
interface DbMock {
  selectFrom: jest.Mock<DbMock, [string]>;
  insertInto: jest.Mock<DbMock, [string]>;
  updateTable: jest.Mock<DbMock, [string]>;
  where: jest.Mock<DbMock, [string, string, unknown]>;
  select: jest.Mock<DbMock, [unknown]>;
  values: jest.Mock<DbMock, [Record<string, unknown>]>;
  set: jest.Mock<DbMock, [Record<string, unknown>]>;
  execute: jest.Mock<Promise<unknown>, []>;
  executeTakeFirst: jest.Mock<Promise<unknown>, []>;
  executeTakeFirstOrThrow: jest.Mock<Promise<unknown>, [() => Error]>;
}

function createDbMock(): DbMock {
  const builder = {} as DbMock;
  builder.selectFrom = jest.fn<DbMock, [string]>().mockReturnValue(builder);
  builder.insertInto = jest.fn<DbMock, [string]>().mockReturnValue(builder);
  builder.updateTable = jest.fn<DbMock, [string]>().mockReturnValue(builder);
  builder.where = jest
    .fn<DbMock, [string, string, unknown]>()
    .mockReturnValue(builder);
  builder.select = jest.fn<DbMock, [unknown]>().mockReturnValue(builder);
  builder.values = jest
    .fn<DbMock, [Record<string, unknown>]>()
    .mockReturnValue(builder);
  builder.set = jest
    .fn<DbMock, [Record<string, unknown>]>()
    .mockReturnValue(builder);
  builder.execute = jest.fn<Promise<unknown>, []>();
  builder.executeTakeFirst = jest.fn<Promise<unknown>, []>();
  builder.executeTakeFirstOrThrow = jest.fn<Promise<unknown>, [() => Error]>();
  return builder;
}

// The `.select(({ fn }) => [...])` call in createApiKey() only makes sense
// against a real Kysely query builder, which we don't have here. When we
// want to check what that callback builds, we invoke it ourselves against
// a small fake `fn` that mimics just the two calls the service makes.
type CountSelectCallback = (args: {
  fn: { count: (column: string) => { as: (alias: string) => string } };
}) => string[];

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let db: ReturnType<typeof createDbMock>;
  let lruCache: { get: jest.Mock; set: jest.Mock; delete: jest.Mock };
  let redis: { del: jest.Mock; hget: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    db = createDbMock();
    lruCache = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
    redis = { del: jest.fn(), hget: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        { provide: KYSELY_DB, useValue: db },
        { provide: LRU_CACHE, useValue: lruCache },
        { provide: REDIS_CACHE, useValue: redis },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
  });

  describe('createApiKey', () => {
    const userId = 'user-123';

    beforeEach(() => {
      mockedArgon2.hash.mockResolvedValue('hashed-value');
    });

    it('creates a key when the user has 0 active keys', async () => {
      db.execute.mockResolvedValueOnce([{ api_count: 0 }]);
      db.executeTakeFirst.mockResolvedValueOnce({
        numInsertedOrUpdatedRows: 1n,
      });

      const result = await service.createApiKey(userId, 'CI server');

      expect(result.apiKey).toMatch(/^srs_[a-f0-9]{32}_[A-Za-z0-9_-]{43}$/);
    });

    it('creates a key when the user is one below the limit (4 active keys)', async () => {
      db.execute.mockResolvedValueOnce([{ api_count: 4 }]);
      db.executeTakeFirst.mockResolvedValueOnce({});

      await expect(
        service.createApiKey(userId, 'CI server'),
      ).resolves.toHaveProperty('apiKey');
      expect(db.insertInto).toHaveBeenCalledWith('api_keys');
    });

    it('rejects with BadRequestException at exactly 5 active keys (boundary)', async () => {
      db.execute.mockResolvedValueOnce([{ api_count: 5 }]);

      await expect(service.createApiKey(userId, 'CI server')).rejects.toThrow(
        BadRequestException,
      );
      // Must short-circuit before ever hashing or inserting anything.
      expect(mockedArgon2.hash).not.toHaveBeenCalled();
      expect(db.insertInto).not.toHaveBeenCalled();
    });

    it('rejects with BadRequestException when already above the limit', async () => {
      db.execute.mockResolvedValueOnce([{ api_count: 9 }]);

      await expect(service.createApiKey(userId, 'CI server')).rejects.toThrow(
        'You have reached the maximum limit of 5 API keys.',
      );
    });

    it('only counts non-revoked keys for the limit check', async () => {
      db.execute.mockResolvedValueOnce([{ api_count: 0 }]);
      db.executeTakeFirst.mockResolvedValueOnce({});

      await service.createApiKey(userId, 'CI server');

      expect(db.where).toHaveBeenCalledWith('user_id', '=', userId);
      expect(db.where).toHaveBeenCalledWith('revoked_at', 'is', null);
    });

    it('builds the count selection as a single "api_count" aggregate column', async () => {
      db.execute.mockResolvedValueOnce([{ api_count: 0 }]);
      db.executeTakeFirst.mockResolvedValueOnce({});

      await service.createApiKey(userId, 'CI server');

      // The service passes a callback (`({ fn }) => [...]`) to .select() -
      // Kysely invokes it internally to build the query. Our mock doesn't
      // do that automatically, so we invoke it ourselves with a fake `fn`
      // builder to check it asks for exactly one aggregate, aliased correctly.
      const selectCallback = db.select.mock.calls[0][0] as CountSelectCallback;
      const fakeAggregateBuilder = {
        as: jest.fn().mockReturnValue('api_count-column'),
      };
      const fakeFn = { count: jest.fn().mockReturnValue(fakeAggregateBuilder) };

      const selection = selectCallback({ fn: fakeFn });

      expect(fakeFn.count).toHaveBeenCalledWith('id');
      expect(fakeAggregateBuilder.as).toHaveBeenCalledWith('api_count');
      expect(selection).toEqual(['api_count-column']);
    });

    it('stores a prefix of the plaintext key followed by "..."', async () => {
      db.execute.mockResolvedValueOnce([{ api_count: 0 }]);
      db.executeTakeFirst.mockResolvedValueOnce({});

      const result = await service.createApiKey(userId, 'CI server');
      const insertedValues = db.values.mock.calls[0][0];

      expect(insertedValues.prefix).toBe(
        result.apiKey.substring(0, 10) + '...',
      );
    });

    it('stores the hashed key (never the plaintext key) and the same id embedded in the plaintext key', async () => {
      db.execute.mockResolvedValueOnce([{ api_count: 0 }]);
      db.executeTakeFirst.mockResolvedValueOnce({});
      mockedArgon2.hash.mockResolvedValueOnce('$argon2id$hashed-secret');

      const result = await service.createApiKey(userId, 'CI server');
      const insertedValues = db.values.mock.calls[0][0];
      const [, embeddedKeyId] = result.apiKey.split('_');

      expect(insertedValues.hashed_key).toBe('$argon2id$hashed-secret');
      expect(insertedValues.hashed_key).not.toBe(result.apiKey);
      expect(insertedValues.id).toBe(embeddedKeyId);
      expect(insertedValues.user_id).toBe(userId);
      expect(insertedValues.api_name).toBe('CI server');
    });

    it('hashes with argon2id and the expected cost parameters', async () => {
      db.execute.mockResolvedValueOnce([{ api_count: 0 }]);
      db.executeTakeFirst.mockResolvedValueOnce({});

      await service.createApiKey(userId, 'CI server');

      expect(mockedArgon2.hash).toHaveBeenCalledWith(
        expect.stringMatching(/^srs_/),
        expect.objectContaining({
          type: argon2.argon2id,
          timeCost: 3,
          memoryCost: 1 << 16,
          parallelism: 1,
        }),
      );
    });

    it('generates a different key on every call (no accidental reuse)', async () => {
      db.execute.mockResolvedValue([{ api_count: 0 }]);
      db.executeTakeFirst.mockResolvedValue({});

      const first = await service.createApiKey(userId, 'Key A');
      const second = await service.createApiKey(userId, 'Key B');

      expect(first.apiKey).not.toBe(second.apiKey);
    });

    it('propagates a database error from the insert instead of swallowing it', async () => {
      db.execute.mockResolvedValueOnce([{ api_count: 0 }]);
      db.executeTakeFirst.mockRejectedValueOnce(new Error('connection lost'));

      await expect(service.createApiKey(userId, 'CI server')).rejects.toThrow(
        'connection lost',
      );
    });
  });

  describe('getAllApiKeys', () => {
    it('returns the keys belonging to the user', async () => {
      const rows = [
        {
          id: '1',
          api_name: 'Key A',
          prefix: 'srs_abc...',
          created_at: new Date(),
          last_used_at: null,
          revoked_at: null,
        },
      ];
      db.execute.mockResolvedValueOnce(rows);

      const result = await service.getAllApiKeys('user-123');

      expect(result).toEqual({ apiKeys: rows });
      expect(db.where).toHaveBeenCalledWith('user_id', '=', 'user-123');
      expect(db.where).toHaveBeenCalledWith('revoked_at', 'is', null);
    });

    it('returns an empty list when the user has no keys', async () => {
      db.execute.mockResolvedValueOnce([]);

      const result = await service.getAllApiKeys('user-with-no-keys');

      expect(result).toEqual({ apiKeys: [] });
    });
  });

  describe('deleteApiKey', () => {
    const userId = 'user-123';
    const apiKeyId = 'key-456';

    it('revokes the key and clears both caches on success', async () => {
      db.executeTakeFirstOrThrow.mockResolvedValueOnce({ revoked_at: null });
      db.executeTakeFirst.mockResolvedValueOnce({ numUpdatedRows: 1n });

      await service.deleteApiKey(userId, apiKeyId);

      expect(db.updateTable).toHaveBeenCalledWith('api_keys');
      expect(db.set).toHaveBeenCalledWith(
        expect.objectContaining({ revoked_at: expect.any(Date) as Date }),
      );
      expect(lruCache.delete).toHaveBeenCalledWith(
        `${CACHE_KEY_VERSION}:${apiKeyId}`,
      );
      expect(redis.del).toHaveBeenCalledWith(
        `srs:api_key:${CACHE_KEY_VERSION}:${apiKeyId}`,
      );
    });

    it('throws BadRequestException when the key does not exist (or belongs to another user)', async () => {
      // Kysely calls executeTakeFirstOrThrow's error-factory callback itself
      // when no row matches; simulate that instead of hand-waving the error,
      // so we're also asserting the factory builds the right exception.
      db.executeTakeFirstOrThrow.mockImplementationOnce((errorFactory) =>
        Promise.reject(errorFactory()),
      );

      const promise = service.deleteApiKey(userId, apiKeyId);

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow('API key not found');
      expect(db.updateTable).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the key is already revoked (no-op re-delete)', async () => {
      db.executeTakeFirstOrThrow.mockResolvedValueOnce({
        revoked_at: new Date(),
      });

      await expect(service.deleteApiKey(userId, apiKeyId)).rejects.toThrow(
        'Bad Request. Try a valid API key',
      );
      // Should not attempt to update an already-revoked row again.
      expect(db.updateTable).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when the update matches zero rows', async () => {
      db.executeTakeFirstOrThrow.mockResolvedValueOnce({ revoked_at: null });
      db.executeTakeFirst.mockResolvedValueOnce({ numUpdatedRows: 0n });

      await expect(service.deleteApiKey(userId, apiKeyId)).rejects.toThrow(
        InternalServerErrorException,
      );
      // Cache must NOT be invalidated if the row was never actually updated.
      expect(lruCache.delete).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('propagates a redis failure during cache invalidation instead of silently succeeding', async () => {
      db.executeTakeFirstOrThrow.mockResolvedValueOnce({ revoked_at: null });
      db.executeTakeFirst.mockResolvedValueOnce({ numUpdatedRows: 1n });
      redis.del.mockRejectedValueOnce(new Error('redis unreachable'));

      await expect(service.deleteApiKey(userId, apiKeyId)).rejects.toThrow(
        'redis unreachable',
      );
    });
  });

  describe('getApiKeyLastUsedAtTimestamp', () => {
    const userId = 'user-123';
    const apiKeyId = 'key-456';

    it('returns null when the key does not belong to the user (or does not exist) - never touching redis', async () => {
      db.executeTakeFirst.mockResolvedValueOnce(undefined); // ownership check finds nothing

      const result = await service.getApiKeyLastUsedAtTimestamp(
        userId,
        apiKeyId,
      );

      expect(result).toBeNull();
      expect(db.where).toHaveBeenCalledWith('user_id', '=', userId);
      expect(redis.hget).not.toHaveBeenCalled();
    });

    it('returns the timestamp from redis once ownership is confirmed', async () => {
      const millis = 1_700_000_000_000;
      db.executeTakeFirst.mockResolvedValueOnce({ id: apiKeyId }); // ownership check passes
      redis.hget.mockResolvedValueOnce(millis.toString());

      const result = await service.getApiKeyLastUsedAtTimestamp(
        userId,
        apiKeyId,
      );

      expect(result).toEqual({ lastUsedAt: new Date(millis) });
      // Only the ownership-check query ran - no second DB round-trip needed
      // once redis has the value.
      expect(db.executeTakeFirst).toHaveBeenCalledTimes(1);
    });

    it('falls back to the database for last_used_at when redis has no cached value', async () => {
      const lastUsedAt = new Date('2026-01-01T00:00:00.000Z');
      db.executeTakeFirst
        .mockResolvedValueOnce({ id: apiKeyId }) // ownership check
        .mockResolvedValueOnce({ last_used_at: lastUsedAt }); // fallback lookup
      redis.hget.mockResolvedValueOnce(null);

      const result = await service.getApiKeyLastUsedAtTimestamp(
        userId,
        apiKeyId,
      );

      expect(result).toEqual({ lastUsedAt });
      expect(db.executeTakeFirst).toHaveBeenCalledTimes(2);
    });

    it('returns null when the key belongs to the user but has never been used', async () => {
      db.executeTakeFirst
        .mockResolvedValueOnce({ id: apiKeyId })
        .mockResolvedValueOnce({ last_used_at: null });
      redis.hget.mockResolvedValueOnce(null);

      const result = await service.getApiKeyLastUsedAtTimestamp(
        userId,
        apiKeyId,
      );

      expect(result).toEqual({ lastUsedAt: null });
    });
  });
});
