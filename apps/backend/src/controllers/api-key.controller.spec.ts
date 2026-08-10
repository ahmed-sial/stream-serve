import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from 'src/services/api-key.service';
import type { SessionContainer } from 'supertokens-node/recipe/session';

// A controller unit test calls the controller's methods directly as plain
// functions - it does NOT go through HTTP, so guards (like
// @UseGuards(SuperTokensAuthGuard) on this controller) and pipes (like
// ParseUUIDPipe, or the global ValidationPipe from main.ts) never run here.
// That's fine: this suite's job is only "does the controller call the
// service with the right arguments, and return what the service gave it".
// Guard behaviour and request validation belong in an e2e/integration test.
describe('ApiKeyController', () => {
  let controller: ApiKeyController;
  let apiKeyService: {
    createApiKey: jest.Mock;
    getAllApiKeys: jest.Mock;
    getApiKeyLastUsedAtTimestamp: jest.Mock;
    deleteApiKey: jest.Mock;
  };

  // Returns both the fake session (typed as SessionContainer, for passing
  // into the controller) and the raw getUserId mock (typed as jest.Mock,
  // for making assertions on) - keeping the two separate avoids TS treating
  // getUserId as an unbound interface method when we assert on it directly.
  const fakeSession = (userId: string) => {
    const getUserId = jest.fn().mockReturnValue(userId);
    const session = { getUserId } as unknown as SessionContainer;
    return { session, getUserId };
  };

  beforeEach(async () => {
    apiKeyService = {
      createApiKey: jest.fn(),
      getAllApiKeys: jest.fn(),
      getApiKeyLastUsedAtTimestamp: jest.fn(),
      deleteApiKey: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeyController],
      providers: [{ provide: ApiKeyService, useValue: apiKeyService }],
    }).compile();

    controller = module.get<ApiKeyController>(ApiKeyController);
  });

  describe('createApiKey', () => {
    it('forwards the session user id and the dto name to the service', async () => {
      const { session } = fakeSession('user-1');
      apiKeyService.createApiKey.mockResolvedValueOnce({ apiKey: 'srs_x' });

      const result = await controller.createApiKey(session, { name: 'My Key' });

      expect(apiKeyService.createApiKey).toHaveBeenCalledWith(
        'user-1',
        'My Key',
      );
      expect(result).toEqual({ apiKey: 'srs_x' });
    });

    it('propagates a rejection from the service (e.g. 5-key limit) instead of swallowing it', async () => {
      const { session } = fakeSession('user-1');
      apiKeyService.createApiKey.mockRejectedValueOnce(
        new Error('You have reached the maximum limit of 5 API keys.'),
      );

      await expect(
        controller.createApiKey(session, { name: 'My Key' }),
      ).rejects.toThrow('You have reached the maximum limit of 5 API keys.');
    });
  });

  describe('getAllApiKeys', () => {
    it("forwards the session user id and returns the service's result", async () => {
      const { session } = fakeSession('user-1');
      const apiKeys = { apiKeys: [{ id: '1', api_name: 'Key A' }] };
      apiKeyService.getAllApiKeys.mockResolvedValueOnce(apiKeys);

      const result = await controller.getAllApiKeys(session);

      expect(apiKeyService.getAllApiKeys).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(apiKeys);
    });

    it('returns an empty list as-is when the user has no keys', async () => {
      const { session } = fakeSession('user-1');
      apiKeyService.getAllApiKeys.mockResolvedValueOnce({ apiKeys: [] });

      const result = await controller.getAllApiKeys(session);

      expect(result).toEqual({ apiKeys: [] });
    });
  });

  describe('getApiKeyLastUsedAtTimestamp', () => {
    it('forwards the session user id and the route param id to the service', async () => {
      const { session, getUserId } = fakeSession('user-1');
      const lastUsedAt = new Date('2026-01-01T00:00:00.000Z');
      apiKeyService.getApiKeyLastUsedAtTimestamp.mockResolvedValueOnce(
        lastUsedAt,
      );

      const result = await controller.getApiKeyLastUsedAtTimestamp(
        session,
        'some-key-id',
      );

      expect(apiKeyService.getApiKeyLastUsedAtTimestamp).toHaveBeenCalledWith(
        'user-1',
        'some-key-id',
      );
      expect(getUserId).toHaveBeenCalled();
      expect(result).toEqual(lastUsedAt);
    });

    it('returns null as-is when the service reports no usage (or no ownership match)', async () => {
      const { session } = fakeSession('user-1');
      apiKeyService.getApiKeyLastUsedAtTimestamp.mockResolvedValueOnce(null);

      const result = await controller.getApiKeyLastUsedAtTimestamp(
        session,
        'some-key-id',
      );

      expect(result).toBeNull();
    });
  });

  describe('deleteApiKey', () => {
    it('forwards the session user id and the validated param id to the service', async () => {
      const { session } = fakeSession('user-1');
      apiKeyService.deleteApiKey.mockResolvedValueOnce(undefined);

      const result = await controller.deleteApiKey(
        session,
        '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      );

      expect(apiKeyService.deleteApiKey).toHaveBeenCalledWith(
        'user-1',
        '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      );
      expect(result).toBeUndefined();
    });

    it('propagates a not-found rejection from the service', async () => {
      const { session } = fakeSession('user-1');
      apiKeyService.deleteApiKey.mockRejectedValueOnce(
        new Error('API key not found'),
      );

      await expect(
        controller.deleteApiKey(
          session,
          '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        ),
      ).rejects.toThrow('API key not found');
    });
  });
});
