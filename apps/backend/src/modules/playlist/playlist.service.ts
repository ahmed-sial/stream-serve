import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { KYSELY_DB } from '../infrastructure/database.module';
import { Kysely } from 'kysely';
import { Database } from 'src/database/database.interface';
import { CreatePlaylistDto } from './dtos/create-playlist.dto';
import { UpdatePlaylistDto } from './dtos/update-playlist.dto';

const DEFAULT_PLAYLIST_COUNT_LIMIT = 10;

@Injectable()
export class PlaylistService {
  constructor(@Inject(KYSELY_DB) private readonly db: Kysely<Database>) {}

  async createPlaylist(userId: string, dto: CreatePlaylistDto) {
    const [result] = await this.db
      .selectFrom('playlists')
      .select(({ fn }) => [fn.count<number>('id').as('playlist_count')])
      .where('user_id', '=', userId)
      .execute();

    if (result.playlist_count >= DEFAULT_PLAYLIST_COUNT_LIMIT)
      throw new BadRequestException('Maximum playlist limit reached');

    const res = await this.db
      .insertInto('playlists')
      .values({
        name: dto.name,
        user_id: userId,
        description: dto.description,
      })
      .returningAll()
      .executeTakeFirst();
    if (!res)
      throw new InternalServerErrorException(
        'Unable to create playlist. Try again later',
      );

    return res;
  }

  async getAllPlaylists(userId: string) {
    return await this.db
      .selectFrom('playlists')
      .select(['id', 'name', 'description', 'total_videos', 'created_at'])
      .where('user_id', '=', userId)
      .execute();
  }

  async getOnePlaylist(userId: string, playlistId: string) {
    return await this.db
      .selectFrom('playlists')
      .select(['id', 'name', 'description', 'total_videos', 'created_at'])
      .where('user_id', '=', userId)
      .where('id', '=', playlistId)
      .executeTakeFirstOrThrow(
        () => new NotFoundException('Playlist not found'),
      );
  }

  async updatePlaylist(
    userId: string,
    playlistId: string,
    dto: UpdatePlaylistDto,
  ) {
    const saved = await this.db
      .selectFrom('playlists')
      .select(['name', 'description'])
      .where('user_id', '=', userId)
      .where('id', '=', playlistId)
      .executeTakeFirstOrThrow(
        () => new NotFoundException('Playlist not found'),
      );
    if (saved.name === dto.name && saved.description === dto.description)
      return saved;
    const result = await this.db
      .updateTable('playlists')
      .set({ name: dto.name, description: dto.description })
      .where('user_id', '=', userId)
      .where('id', '=', playlistId)
      .returning(['name', 'description'])
      .executeTakeFirstOrThrow(
        () => new NotFoundException('Playlist not found'),
      );
    return result;
  }

  async deletePlaylist(userId: string, playlistId: string) {
    const result = await this.db
      .deleteFrom('playlists')
      .where('user_id', '=', userId)
      .where('id', '=', playlistId)
      .returning(['id', 'name'])
      .executeTakeFirstOrThrow(
        () => new NotFoundException('Playlist not found'),
      );
    return result;
  }
}
