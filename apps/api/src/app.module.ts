import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentsModule } from './agents/agents.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CallsModule } from './calls/calls.module';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { LiveKitModule } from './livekit/livekit.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { VoicesModule } from './voices/voices.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    AgentsModule,
    VoicesModule,
    HealthModule,
    ScheduleModule.forRoot(),
    LiveKitModule,
    CallsModule,
    InternalModule,
    WebhooksModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.raw.LOG_LEVEL,
          genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
          transport: config.isProduction
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: 'SYS:standard',
                },
              },
          autoLogging: {
            ignore: (req) => req.url === '/api/health',
          },
        },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
