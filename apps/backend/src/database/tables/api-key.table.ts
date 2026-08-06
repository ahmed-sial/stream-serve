import { Generated } from 'kysely';

export interface ApiKeyTable {
  id: Generated<string>;
  userId: string;
  prefix: string;
  name: string;
  hashedKey: string;
  createdAt: Generated<Date>;
  lastUpdatedAt: Date | null;
  revokedAt: Date | null;
}
