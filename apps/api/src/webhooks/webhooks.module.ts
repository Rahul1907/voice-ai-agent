import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module';
import { AppConfigModule } from '../config/app-config.module';
import { LiveKitModule } from '../livekit/livekit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [PrismaModule, AppConfigModule, LiveKitModule, CallsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
