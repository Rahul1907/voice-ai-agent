import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { AppConfigService } from '../config/app-config.service';
import { FakeLiveKitGateway } from './fake-livekit.gateway';
import { LIVEKIT_GATEWAY } from './livekit.interface';
import { LiveKitService } from './livekit.service';

@Module({
  imports: [AppConfigModule],
  providers: [
    LiveKitService,
    FakeLiveKitGateway,
    {
      provide: LIVEKIT_GATEWAY,
      inject: [AppConfigService, LiveKitService, FakeLiveKitGateway],
      useFactory: (
        config: AppConfigService,
        realService: LiveKitService,
        fakeService: FakeLiveKitGateway,
      ) => {
        if (config.providerMode === 'mock' || config.isTest) {
          return fakeService;
        }
        return realService;
      },
    },
  ],
  exports: [LIVEKIT_GATEWAY, LiveKitService, FakeLiveKitGateway],
})
export class LiveKitModule {}
