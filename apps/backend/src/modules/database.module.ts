import { Global, Module } from '@nestjs/common';
import { createDatabase } from 'src/database/database.factory';

export const KYSELY_DB = 'KYSELY_DB';

@Global()
@Module({
  providers: [
    {
      provide: KYSELY_DB,
      useFactory: createDatabase,
    },
  ],
  exports: [KYSELY_DB],
})
export class DatabaseModule {}
