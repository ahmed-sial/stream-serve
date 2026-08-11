import { Generated } from 'kysely';
export interface PlaylistTable {
  id: Generated<string>;
  user_id: string;
  name: string;
  description: string | null;
  playlist_limit: number;
  total_videos: number;
  created_at: Generated<Date>;
}
