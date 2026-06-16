import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { LRUCacheModule } from './infrastructure/lru-cache.module';
import { RedisModule } from './infrastructure/redis.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiKeyLastUsedCron } from './scheduler/api-key-last-used.cron';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    LRUCacheModule,
    RedisModule,
  ],
  controllers: [AppController],
  providers: [AppService, ApiKeyLastUsedCron],
})
export class AppModule {}
