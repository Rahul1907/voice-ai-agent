import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { LiveKitModule } from '../livekit/livekit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CallsCleanupService } from './calls-cleanup.service';
import { CallsConcurrencyService } from './calls-concurrency.service';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

@Module({
  imports: [PrismaModule, AppConfigModule, LiveKitModule],
  controllers: [CallsController],
  providers: [CallsService, CallsConcurrencyService, CallsCleanupService],
  exports: [CallsService, CallsConcurrencyService, CallsCleanupService],
})
export class CallsModule {}
