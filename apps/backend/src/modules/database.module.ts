import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDatabase } from 'src/database/database.factory';

export const KYSELY_DB = 'KYSELY_DB';

@Global()
@Module({
  providers: [
    {
      provide: KYSELY_DB,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.getOrThrow<string>('DB_URL');
        return createDatabase(connectionString);
      },
    },
  ],
  exports: [KYSELY_DB],
})
export class DatabaseModule {}
