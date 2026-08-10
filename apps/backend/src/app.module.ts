import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './modules/infrastructure/database.module';
import { LRUCacheModule } from './modules/infrastructure/lru-cache.module';
import { RedisCacheModule } from './modules/infrastructure/redis-cache.module';
import { SuperTokensModule } from 'supertokens-nestjs';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import { ApiKeyModule } from './modules/api-key/api-key.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiKeyUsageCronJob } from './schedular/api-key-last-used-at.cron';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    LRUCacheModule,
    RedisCacheModule,
    SuperTokensModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        framework: 'express',
        supertokens: {
          connectionURI: configService.getOrThrow('SUPERTOKENS_CONNECTION_URI'),
        },
        appInfo: {
          appName: 'StreamServe',
          apiDomain: configService.getOrThrow('API_DOMAIN'),
          websiteDomain: configService.getOrThrow('WEBSITE_DOMAIN'),
          apiBasePath: '/api/auth',
          websiteBasePath: '/auth',
        },
        recipeList: [EmailPassword.init(), Session.init()],
      }),
    }),
    ApiKeyModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService, ApiKeyUsageCronJob],
})
export class AppModule {}
