import { Module } from '@nestjs/common';
import { PlaylistController } from './playlist.controller';
import { PlaylistService } from './playlist.service';
import { APP_GUARD } from '@nestjs/core';
import { OrAuthGuard } from 'src/guards/conditional-or-auth.guard';
import { ApiKeyAuthGuard } from 'src/guards/api-key-auth.guard';
import { CustomSuperTokensAuthGuard } from 'src/guards/custom-super-token-auth-with-session.guard';

@Module({
  imports: [],
  controllers: [PlaylistController],
  providers: [
    PlaylistService,
    { provide: APP_GUARD, useClass: OrAuthGuard },
    CustomSuperTokensAuthGuard,
    ApiKeyAuthGuard,
    OrAuthGuard,
  ],
})
export class PlaylistModule {}
