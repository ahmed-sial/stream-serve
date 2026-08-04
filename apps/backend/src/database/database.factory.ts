import { Kysely, PostgresDialect } from 'kysely';
import { Database } from './database.interface';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

export function createDatabase(configService: ConfigService, logger: Logger) {
  const connectionString = configService.get<string>('DB_URL');
  if (!connectionString) throw new Error('DB_URL is required');
  const pool = new Pool({
    connectionString,
    max: 10,
  });
  pool.on('connect', () => logger.log('Database connected successfully'));
  pool.on('error', (err) => logger.error('Database pool error', err.stack));
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool,
    }),
  });
}
