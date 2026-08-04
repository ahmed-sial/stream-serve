import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDatabase } from 'src/database/database.factory';

export const KYSELY_DB = 'KYSELY_DB';

@Global()
@Module({
  providers: [
    {
      provide: KYSELY_DB,
      inject: [ConfigService, Logger],
      useFactory: createDatabase,
    },
  ],
  exports: [KYSELY_DB],
})
export class DatabaseModule {}
