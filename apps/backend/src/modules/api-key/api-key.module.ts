import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyAuthGuard } from 'src/guards/api-key-auth/api-key-auth.guard';
import { CustomSuperTokensAuthGuard } from 'src/guards/custom-super-token-auth/custom-super-token-auth-with-session.guard';
import { ApiKeyController } from 'src/modules/api-key/api-key.controller';
import { ApiKeyService } from 'src/modules/api-key/api-key.service';

@Module({
  imports: [],
  controllers: [ApiKeyController],
  providers: [
    ApiKeyService,
    ApiKeyAuthGuard,
    { provide: APP_GUARD, useClass: CustomSuperTokensAuthGuard },
  ],
  exports: [],
})
export class ApiKeyModule {}
