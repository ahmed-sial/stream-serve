import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './modules/database.module';
import { LRUCacheModule } from './modules/cache.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    LRUCacheModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
