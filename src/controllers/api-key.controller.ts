import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyService } from '../services/api-key.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { ApiKeyRequestUser } from '../common/types/ApiKeyRequestUser';
import { ClerkAuthGuard } from '../guards/clerk-auth.guard';

@Controller('api-key')
@UseGuards(ClerkAuthGuard)
@ApiTags('API Keys')
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private readonly service: ApiKeyService) {}

  @Post()
  @ApiOperation({ summary: 'Generate new API key' })
  generateApiKey(@CurrentUser() { user }: ApiKeyRequestUser) {
    return this.service.createNewApiKey(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Fetch all API keys' })
  fetchApiKeys(@CurrentUser() { user }: ApiKeyRequestUser) {
    return this.service.getAllApiKeysForUser(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete (revoke) API key' })
  deleteApiKey(
    @Param('id') id: string,
    @CurrentUser() { user }: ApiKeyRequestUser,
  ) {
    return this.service.deleteApiKey(id, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get API key last used' })
  async fetchApiLastUsedTime(
    @CurrentUser() { user }: ApiKeyRequestUser,
    @Param('id') id: string,
  ) {
    return this.service.getApiKeyLastUsedTime(id);
  }

  @Post('r/:id')
  @ApiOperation({ summary: 'Regenerate API key' })
  regenerateApiKey(
    @CurrentUser() { user }: ApiKeyRequestUser,
    @Param('id') apiId: string,
  ) {
    return this.service.regenerateApiKey(user.id, apiId);
  }
}
