import dotenv from 'dotenv';
import { Kysely, PostgresDialect } from 'kysely';
import { Database } from './database.interface';
import { Pool } from 'pg';

dotenv.config();

export function createDatabase() {
  const connectionString = process.env.DB_URL;
  if (!connectionString) throw new Error('DB_URL is required');
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString,
        max: 10,
      }),
    }),
  });
}
