import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module';
import { AppConfigModule } from '../config/app-config.module';
import { LiveKitModule } from '../livekit/livekit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InternalKeyGuard } from './guards/internal-key.guard';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';

@Module({
  imports: [PrismaModule, AppConfigModule, LiveKitModule, CallsModule],
  controllers: [InternalController],
  providers: [InternalService, InternalKeyGuard],
  exports: [InternalService, InternalKeyGuard],
})
export class InternalModule {}
