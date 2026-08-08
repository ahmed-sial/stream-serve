import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ApiKeyService } from 'src/services/api-key.service';
import { Session, VerifySession } from 'supertokens-nestjs';
import type { SessionContainer } from 'supertokens-node/recipe/session';

@Controller('api-key')
@UseGuards(AuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post('/create')
  async createApiKey(
    @Session('accessTokenPayload') payload,
    @Body('name') apiKeyName: string,
  ) {
    return this.apiKeyService.createApiKey(payload.userId, apiKeyName);
  }

  @Get()
  async getAllApiKeys(@Session() session: SessionContainer) {
    const userId = session.getAccessTokenPayload()['userId'];
    return this.apiKeyService.getAllApiKeys(userId);
  }
}
