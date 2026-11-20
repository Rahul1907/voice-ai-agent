import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CallEndReason, CallStatus } from '@prisma/client';
import { LIVEKIT_GATEWAY, LiveKitGateway } from '../livekit/livekit.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CallsConcurrencyService } from './calls-concurrency.service';

@Injectable()
export class CallsCleanupService {
  private readonly logger = new Logger(CallsCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly concurrency: CallsConcurrencyService,
    @Inject(LIVEKIT_GATEWAY)
    private readonly livekitGateway: LiveKitGateway,
  ) {}

  @Cron('*/60 * * * * *')
  async cleanupStaleCalls(): Promise<{ failedCount: number; timedOutCount: number }> {
    let failedCount = 0;
    let timedOutCount = 0;

    // 1. Clean up CREATED calls older than 2 minutes (120 seconds)
    const twoMinutesAgo = new Date(Date.now() - 120 * 1000);
    const staleCreated = await this.prisma.call.findMany({
      where: {
        status: CallStatus.CREATED,
        createdAt: { lt: twoMinutesAgo },
      },
    });

    for (const call of staleCreated) {
      try {
        await this.prisma.call.update({
          where: { id: call.id },
          data: {
            status: CallStatus.FAILED,
            errorMessage: 'Agent did not join',
            endedAt: new Date(),
          },
        });
        await this.concurrency.releaseSlot();
        await this.livekitGateway.deleteRoom(call.roomName).catch(() => {});
        failedCount++;
        this.logger.warn(`Stale CREATED call ${call.id} marked as FAILED`);
      } catch (err) {
        this.logger.error(`Failed cleaning up CREATED call ${call.id}: ${(err as Error).message}`);
      }
    }

    // 2. Clean up ACTIVE calls running beyond maxCallDurationSec + 60s
    const activeCalls = await this.prisma.call.findMany({
      where: {
        status: CallStatus.ACTIVE,
        startedAt: { not: null },
      },
      include: {
        agent: {
          select: { maxCallDurationSec: true },
        },
      },
    });

    const now = Date.now();
    for (const call of activeCalls) {
      if (!call.startedAt) continue;

      const maxDurationSec = call.agent?.maxCallDurationSec ?? 600;
      const allowedDurationMs = (maxDurationSec + 60) * 1000;

      if (now - call.startedAt.getTime() > allowedDurationMs) {
        try {
          const endedAt = new Date();
          const durationSec = Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000);

          await this.prisma.call.update({
            where: { id: call.id },
            data: {
              status: CallStatus.ENDED,
              endReason: CallEndReason.TIMEOUT,
              endedAt,
              durationSec,
            },
          });
          await this.concurrency.releaseSlot();
          await this.livekitGateway.deleteRoom(call.roomName).catch(() => {});
          timedOutCount++;
          this.logger.warn(`Stale ACTIVE call ${call.id} timed out and marked as ENDED`);
        } catch (err) {
          this.logger.error(`Failed timing out ACTIVE call ${call.id}: ${(err as Error).message}`);
        }
      }
    }

    return { failedCount, timedOutCount };
  }
}
