import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlaylistService } from './playlist.service';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user.type';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';

@Controller({
  path: 'playlist',
  version: '1',
})
@UseGuards(ClerkAuthGuard)
@ApiTags('Playlists API')
@ApiBearerAuth()
export class PlaylistController {
  constructor(private readonly service: PlaylistService) {}
  @Post()
  @ApiOperation({ summary: 'Create a playlist' })
  createPlaylist(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePlaylistDto,
  ) {
    return this.service.createPlaylist(dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a playlist' })
  updatePlaylist(
    @CurrentUser() user: RequestUser,
    @Param('id') playlistId: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.service.updatePlaylist(playlistId, dto, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one playlist by id' })
  fetchPlaylist(
    @CurrentUser() user: RequestUser,
    @Param('id') playlistId: string,
  ) {
    return this.service.getPlaylist(playlistId, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all playlists for a user' })
  fetchAllPlaylists(@CurrentUser() user: RequestUser) {
    return this.service.getAllPlaylists(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a playlist' })
  deletePlaylist(
    @CurrentUser() user: RequestUser,
    @Param('id') playlistId: string,
  ) {
    return this.service.deletePlaylist(playlistId, user.id);
  }
}
