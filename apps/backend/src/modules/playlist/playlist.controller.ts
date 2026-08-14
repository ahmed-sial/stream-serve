import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PlaylistService } from './playlist.service';
import { CreatePlaylistDto } from './dtos/create-playlist.dto';
import { UpdatePlaylistDto } from './dtos/update-playlist.dto';
import { UserId } from 'src/decorators/global/user-id.decorator';
import { OrGuard } from 'src/guards/or.guard';
import { CustomSuperTokensAuthGuard } from 'src/guards/custom-super-token-auth/custom-super-token-auth-with-session.guard';
import { ApiKeyAuthGuard } from 'src/guards/api-key-auth/api-key-auth.guard';

@UseGuards(OrGuard(CustomSuperTokensAuthGuard, ApiKeyAuthGuard))
@Controller('playlists')
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Post()
  async createPlaylist(
    @UserId() userId: string,
    @Body() dto: CreatePlaylistDto,
  ) {
    return this.playlistService.createPlaylist(userId, dto);
  }

  @Get()
  async getAllPlaylists(@UserId() userId: string) {
    return this.playlistService.getAllPlaylists(userId);
  }

  @Get(':id')
  async getOnePlaylist(
    @UserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) playlistId: string,
  ) {
    return this.playlistService.getOnePlaylist(userId, playlistId);
  }

  @Patch(':id')
  async updatePlaylist(
    @UserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) playlistId: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlistService.updatePlaylist(userId, playlistId, dto);
  }

  @Delete(':id')
  async deletePlaylist(
    @UserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) playlistId: string,
  ) {
    return this.playlistService.deletePlaylist(userId, playlistId);
  }
}
