import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppConfigService } from './config/app-config.service';

export function setupApp(app: INestApplication, config: AppConfigService): INestApplication {
  app.setGlobalPrefix('api');

  // Security headers via helmet
  app.use(helmet());

  // Cookie parsing for JWT auth
  app.use(cookieParser());

  // Strict CORS policy
  app.enableCors({
    origin: config.webOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-internal-key', 'x-request-id'],
  });

  // Global input validation and transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter with standard error shape and requestId
  app.useGlobalFilters(new AllExceptionsFilter(config));

  return app;
}
