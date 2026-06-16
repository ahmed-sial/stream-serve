import { Global, InternalServerErrorException, Module } from '@nestjs/common';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './schema';
import { drizzle } from 'drizzle-orm/neon-serverless';

export const DRIZZLE_DB = 'DRIZZLE_DB';

neonConfig.webSocketConstructor = ws;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString)
          throw new InternalServerErrorException(
            'An unexpected error occurred on our side. Try again later.',
          );
        const pool = new Pool({ connectionString });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
