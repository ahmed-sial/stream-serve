import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../../database/schema';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { DRIZZLE_DB } from '../../database/database.module';
import { and, count, eq, max } from 'drizzle-orm';
import { playlistTable } from '../../database/schema';
import { DEFAULT_PLAYLIST_LIMIT } from '../../common/types/constants';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';

@Injectable()
export class PlaylistService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async createPlaylist(dto: CreatePlaylistDto, userId: string) {
    const [result] = await this.db
      .select({ count: count(), limit: max(playlistTable.limit) })
      .from(playlistTable)
      .where(eq(playlistTable.userId, userId));
    const effectiveLimit = result.limit ?? DEFAULT_PLAYLIST_LIMIT;
    if (result.count >= effectiveLimit) {
      throw new BadRequestException(
        'Maximum playlist limit reached. Contact support for more details.',
      );
    }
    const [saved] = await this.db
      .insert(playlistTable)
      .values({
        name: dto.name,
        description: dto.description ?? null,
        userId,
        createdAt: new Date(),
      })
      .returning();
    return saved;
  }

  async updatePlaylist(
    playlistId: string,
    dto: UpdatePlaylistDto,
    userId: string,
  ) {
    const [updated] = await this.db
      .update(playlistTable)
      .set(dto)
      .where(
        and(eq(playlistTable.id, playlistId), eq(playlistTable.userId, userId)),
      )
      .returning();
    if (!updated) throw new NotFoundException('Playlist not found.');
    return updated;
  }

  async deletePlaylist(playlistId: string, userId: string) {
    const [deleted] = await this.db
      .delete(playlistTable)
      .where(
        and(eq(playlistTable.id, playlistId), eq(playlistTable.userId, userId)),
      )
      .returning();
    if (!deleted) throw new NotFoundException('Playlist not found.');
    return deleted;
  }

  async getPlaylist(playlistId: string, userId: string) {
    const playlist = await this.db.query.playlistTable.findFirst({
      where: and(
        eq(playlistTable.id, playlistId),
        eq(playlistTable.userId, userId),
      ),
    });
    if (!playlist) throw new NotFoundException('Playlist not found.');
    return playlist;
  }

  async getAllPlaylists(userId: string) {
    return this.db
      .select()
      .from(playlistTable)
      .where(eq(playlistTable.userId, userId));
  }
}
