import { Kysely, PostgresDialect } from 'kysely';
import { Database } from './database.interface';
import { Pool } from 'pg';
import { Logger } from '@nestjs/common';

export async function createDatabase(connectionString: string) {
  const logger = new Logger('Database');

  const pool = new Pool({
    connectionString,
    max: 10,
  });

  try {
    await pool.query('SELECT 1');
    logger.log('Database connected successfully');
  } catch (err) {
    logger.error('Failed to connect to database', err);
    throw err;
  }

  pool.on('error', (err) => {
    logger.error('Unexpected database pool error', err);
  });

  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool,
    }),
  });
}
