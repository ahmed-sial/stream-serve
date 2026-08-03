import dotenv from 'dotenv';
import { Kysely, PostgresDialect } from 'kysely';
import { Database } from './database.interface';
import { Pool } from 'pg';

dotenv.config();

export function createDatabase() {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DB_URL,
        max: 10,
      }),
    }),
  });
}
