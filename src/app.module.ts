import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { LRUCacheModule } from './infrastructure/lru-cache.module';
import { RedisModule } from './infrastructure/redis.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiKeyLastUsedCron } from './scheduler/api-key-last-used.cron';
import { ApiKeyModule } from './modules/api-key.module';
import { PlaylistModule } from './modules/playlist/playlist.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    LRUCacheModule,
    RedisModule,
    ApiKeyModule,
    PlaylistModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService, ApiKeyLastUsedCron],
})
export class AppModule {}
