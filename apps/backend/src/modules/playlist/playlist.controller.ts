import {
  Body,
  Controller,
  UseGuards,
  Post,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Delete,
} from '@nestjs/common';
import { PlaylistService } from './playlist.service';
import { Session, SuperTokensAuthGuard } from 'supertokens-nestjs';
import type { SessionContainer } from 'supertokens-node/recipe/session';
import { CreatePlaylistDto } from './dtos/create-playlist.dto';
import { UpdatePlaylistDto } from './dtos/update-playlist.dto';

@Controller('playlists')
@UseGuards(SuperTokensAuthGuard)
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Post()
  async createPlaylist(
    @Session() session: SessionContainer,
    @Body() dto: CreatePlaylistDto,
  ) {
    return this.playlistService.createPlaylist(session.getUserId(), dto);
  }

  @Get()
  async getAllPlaylists(@Session() session: SessionContainer) {
    return this.playlistService.getAllPlaylists(session.getUserId());
  }

  @Get(':id')
  async getOnePlaylist(
    @Session() session: SessionContainer,
    @Param('id', new ParseUUIDPipe({ version: '4' })) playlistId: string,
  ) {
    return this.playlistService.getOnePlaylist(session.getUserId(), playlistId);
  }

  @Patch()
  async updatePlaylist(
    @Session() session: SessionContainer,
    @Param('id', new ParseUUIDPipe({ version: '4' })) playlistId: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlistService.updatePlaylist(
      session.getUserId(),
      playlistId,
      dto,
    );
  }

  @Delete()
  async deletePlaylist(
    @Session() session: SessionContainer,
    @Param('id', new ParseUUIDPipe({ version: '4' })) playlistId: string,
  ) {
    return this.playlistService.deletePlaylist(session.getUserId(), playlistId);
  }
}
