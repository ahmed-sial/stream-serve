import { ApiKeyTable } from './tables/api-key.table';
import { PlaylistTable } from './tables/playlist.table';

export interface Database {
  api_keys: ApiKeyTable;
  playlists: PlaylistTable;
}
// ? should selectable, insertable and updateable be added or not and what is their use
