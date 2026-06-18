import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyService } from '../services/api-key.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClerkAuthGuard } from '../guards/clerk-auth.guard';
import type { RequestUser } from '../common/types/request-user.type';

@Controller({
  path: 'api-key',
  version: '1',
})
@UseGuards(ClerkAuthGuard)
@ApiTags('API Keys')
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private readonly service: ApiKeyService) {}

  @Post()
  @ApiOperation({ summary: 'Generate new API key' })
  generateApiKey(@CurrentUser() user: RequestUser) {
    return this.service.createNewApiKey(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Fetch all API keys' })
  fetchApiKeys(@CurrentUser() user: RequestUser) {
    return this.service.getAllApiKeysForUser(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete (revoke) API key' })
  deleteApiKey(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.deleteApiKey(id, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get API key last used' })
  async fetchApiLastUsedTime(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getApiKeyLastUsedTime(id, user.id);
  }

  @Post('r/:id')
  @ApiOperation({ summary: 'Regenerate API key' })
  regenerateApiKey(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) apiId: string,
  ) {
    return this.service.regenerateApiKey(user.id, apiId);
  }
}
