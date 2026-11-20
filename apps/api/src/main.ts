import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get(AppConfigService);

  setupApp(app, config);

  // Swagger documentation (disabled in production)
  if (!config.isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Voice AI Agent Platform API')
      .setDescription('REST API for Voice AI Agent Platform')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .addApiKey({ type: 'apiKey', name: 'x-internal-key', in: 'header' }, 'internal-key')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(config.port);
  logger.log(`API is running on http://localhost:${config.port}/api`);
  if (!config.isProduction) {
    logger.log(`Swagger UI is available at http://localhost:${config.port}/api/docs`);
  }
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
