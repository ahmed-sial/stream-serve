import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './modules/database.module';
import { LRUCacheModule } from './modules/lru-cache.module';
import { RedisCacheModule } from './modules/redis-cache.module';
import { SuperTokensModule } from 'supertokens-nestjs';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import dotenv from 'dotenv';
import { ApiKeyModule } from './modules/api-key.module';

dotenv.config;

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
          apiBasePath: '/auth',
          websiteBasePath: '/auth',
        },
        recipeList: [EmailPassword.init(), Session.init()],
      }),
    }),
    ApiKeyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
