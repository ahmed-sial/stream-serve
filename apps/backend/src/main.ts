import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import supertokens from 'supertokens-node';
import { SuperTokensExceptionFilter } from 'supertokens-nestjs';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ApiResponseTransformerInterceptor } from './interceptors/api-response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.enableCors({
    origin: [process.env.WEBSITE_DOMAIN],
    allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
    credentials: true,
  });

  app.useGlobalInterceptors(new ApiResponseTransformerInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new SuperTokensExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
