import { Module } from '@nestjs/common';
import { PlaylistController } from './playlist.controller';
import { PlaylistService } from './playlist.service';
import { ApiKeyAuthGuard } from 'src/guards/api-key-auth/api-key-auth.guard';
import { CustomSuperTokensAuthGuard } from 'src/guards/custom-super-token-auth/custom-super-token-auth-with-session.guard';

@Module({
  imports: [],
  controllers: [PlaylistController],
  providers: [PlaylistService, CustomSuperTokensAuthGuard, ApiKeyAuthGuard],
})
export class PlaylistModule {}
