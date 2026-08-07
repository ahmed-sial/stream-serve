import { ApiKeyTable } from './tables/api-key.table';

export interface Database {
  api_keys: ApiKeyTable;
}
// should selectable, insertable and updateable be added or not and what is their use
