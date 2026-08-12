import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateApiKeyDto } from 'src/modules/api-key/dtos/create-api-key.dto';
import { ApiKeyService } from 'src/modules/api-key/api-key.service';
import { UserId } from 'src/decorators/global/user-id.decorator';

@Controller('apikeys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post('/create')
  async createApiKey(
    @UserId() userId: string,
    @Body('apiKeyProps') apiKeyProps: CreateApiKeyDto,
  ) {
    return this.apiKeyService.createApiKey(userId, apiKeyProps.name);
  }

  @Get()
  async getAllApiKeys(@UserId() userId: string) {
    return this.apiKeyService.getAllApiKeys(userId);
  }

  @Get(':id')
  async getApiKeyLastUsedAtTimestamp(
    @UserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.apiKeyService.getApiKeyLastUsedAtTimestamp(userId, id);
  }

  @Delete(':id')
  async deleteApiKey(
    @UserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) apiKeyId: string,
  ) {
    return this.apiKeyService.deleteApiKey(userId, apiKeyId);
  }
}
