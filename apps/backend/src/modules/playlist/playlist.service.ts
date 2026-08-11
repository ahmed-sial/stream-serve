import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { KYSELY_DB } from '../infrastructure/database.module';
import { Kysely } from 'kysely';
import { Database } from 'src/database/database.interface';
import { CreatePlaylistDto } from './dtos/create-playlist.dto';

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
      .returning([
        'id',
        'name',
        'description',
        'total_videos',
        'created_at',
        'user_id',
      ])
      .executeTakeFirst();
    if (!res)
      throw new InternalServerErrorException(
        'Unable to create playlist. Try again later',
      );

    return res;
  }
}
