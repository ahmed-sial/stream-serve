import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateApiKeyDto } from 'src/dtos/create-api-key.dto';
import { ApiKeyService } from 'src/services/api-key.service';
import { Session, SuperTokensAuthGuard } from 'supertokens-nestjs';
import type { SessionContainer } from 'supertokens-node/recipe/session';

@Controller('apikeys')
@UseGuards(SuperTokensAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post('/create')
  async createApiKey(
    @Session() session: SessionContainer,
    @Body('apiKeyProps') apiKeyProps: CreateApiKeyDto,
  ) {
    return this.apiKeyService.createApiKey(
      session.getUserId(),
      apiKeyProps.name,
    );
  }

  @Get()
  async getAllApiKeys(@Session() session: SessionContainer) {
    return this.apiKeyService.getAllApiKeys(session.getUserId());
  }

  @Delete(':id')
  async deleteApiKey(
    @Session() session: SessionContainer,
    @Param('id', new ParseUUIDPipe({ version: '4' })) apiKeyId: string,
  ) {
    return this.apiKeyService.deleteApiKey(session.getUserId(), apiKeyId);
  }
}
