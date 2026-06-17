import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { VersioningType } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const apiDocsConfig = new DocumentBuilder()
    .setTitle('Stream Serve API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  const document = SwaggerModule.createDocument(app, apiDocsConfig);
  SwaggerModule.setup('api/docs', app, document);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
