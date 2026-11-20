import { Injectable, Logger } from '@nestjs/common';
import { CallEndReason, CallStatus } from '@prisma/client';
import { WebhookEvent } from 'livekit-server-sdk';
import { CallsConcurrencyService } from '../calls/calls-concurrency.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly concurrency: CallsConcurrencyService,
  ) {}

  async handleLiveKitEvent(event: WebhookEvent): Promise<{ status: string; handled: boolean }> {
    const eventType = event.event;
    const roomName = event.room?.name;

    if (!roomName) {
      return { status: 'ignored', handled: false };
    }

    const call = await this.prisma.call.findUnique({
      where: { roomName },
    });

    if (!call) {
      // WH-03: Unknown room ignored with 200 OK
      this.logger.debug(`Webhook received for unknown room ${roomName}, ignoring.`);
      return { status: 'ignored', handled: false };
    }

    // WH-05: Idempotent - if already ENDED or FAILED, no duplicate effects
    if (call.status === CallStatus.ENDED || call.status === CallStatus.FAILED) {
      return { status: 'already_finished', handled: false };
    }

    if (eventType === 'room_finished') {
      // WH-01: Valid room_finished for ACTIVE call -> ENDED, reason DISCONNECTED
      const endedAt = new Date();
      const durationSec = call.startedAt
        ? Math.max(0, Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000))
        : 0;

      await this.prisma.call.update({
        where: { id: call.id },
        data: {
          status: CallStatus.ENDED,
          endReason: CallEndReason.DISCONNECTED,
          endedAt,
          durationSec,
        },
      });

      await this.concurrency.releaseSlot();
      this.logger.log(`Call ${call.id} ended via room_finished webhook (DISCONNECTED)`);
      return { status: 'ended', handled: true };
    }

    if (eventType === 'participant_left') {
      const participant = event.participant;
      // WH-04: participant_left for the user -> Call ended
      const isUser =
        participant?.identity === `user-${call.userId}` ||
        participant?.identity?.startsWith('user-');

      if (isUser) {
        const endedAt = new Date();
        const durationSec = call.startedAt
          ? Math.max(0, Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000))
          : 0;

        await this.prisma.call.update({
          where: { id: call.id },
          data: {
            status: CallStatus.ENDED,
            endReason: CallEndReason.USER_HANGUP,
            endedAt,
            durationSec,
          },
        });

        await this.concurrency.releaseSlot();
        this.logger.log(`Call ${call.id} ended via participant_left webhook (USER_HANGUP)`);
        return { status: 'ended', handled: true };
      }
    }

    return { status: 'acknowledged', handled: false };
  }
}
