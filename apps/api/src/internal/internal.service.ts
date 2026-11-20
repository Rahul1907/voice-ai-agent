import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CallEndReason, CallStatus, DocumentStatus } from '@prisma/client';
import { WorkerCallConfigDto } from '@voice-ai/shared';
import { CallsConcurrencyService } from '../calls/calls-concurrency.service';
import { AppConfigService } from '../config/app-config.service';
import { LIVEKIT_GATEWAY, LiveKitGateway } from '../livekit/livekit.interface';
import { PrismaService } from '../prisma/prisma.service';
import { EndCallInternalDto } from './dto/end-call-internal.dto';
import { IngestTurnMetricDto } from './dto/ingest-metrics.dto';
import { IngestTranscriptSegmentDto } from './dto/ingest-transcripts.dto';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly concurrency: CallsConcurrencyService,
    @Inject(LIVEKIT_GATEWAY)
    private readonly livekitGateway: LiveKitGateway,
  ) {}

  async getCallConfig(callId: string): Promise<WorkerCallConfigDto> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        agent: {
          include: {
            documents: {
              where: { status: DocumentStatus.READY },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!call || !call.agent) {
      throw new NotFoundException('Call not found');
    }

    // Sanitized agent config with NO keys, secrets, or internal information (SEC-09)
    return {
      callId: call.id,
      agentId: call.agent.id,
      agentName: call.agent.name,
      systemPrompt: call.agent.systemPrompt,
      greeting: call.agent.greeting,
      voice: call.agent.voice,
      llmModel: call.agent.llmModel,
      temperature: call.agent.temperature,
      maxCallDurationSec: call.agent.maxCallDurationSec,
      hasKnowledgeBase: call.agent.documents.length > 0,
      timezone: this.config.defaultTimezone,
    };
  }

  async markCallStarted(callId: string): Promise<{ status: CallStatus; startedAt: Date }> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    const startedAt = call.startedAt ?? new Date();

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.ACTIVE,
        startedAt,
      },
    });

    return {
      status: updated.status,
      startedAt: updated.startedAt ?? startedAt,
    };
  }

  async markCallEnded(callId: string, dto: EndCallInternalDto): Promise<void> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    // Idempotent: If already ended or failed, do nothing
    if (call.status === CallStatus.ENDED || call.status === CallStatus.FAILED) {
      return;
    }

    const endedAt = new Date();
    const durationSec = call.startedAt
      ? Math.max(0, Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000))
      : 0;

    const newStatus = dto.reason === CallEndReason.ERROR ? CallStatus.FAILED : CallStatus.ENDED;

    await this.prisma.call.update({
      where: { id: call.id },
      data: {
        status: newStatus,
        endReason: dto.reason,
        errorMessage: dto.errorMessage ?? null,
        endedAt,
        durationSec,
      },
    });

    // Release concurrency slot
    await this.concurrency.releaseSlot();

    // Clean up LiveKit room
    await this.livekitGateway.deleteRoom(call.roomName).catch((err) => {
      this.logger.warn(`Could not delete LiveKit room ${call.roomName}: ${(err as Error).message}`);
    });
  }

  async ingestTranscripts(
    callId: string,
    segments: IngestTranscriptSegmentDto[],
  ): Promise<{ inserted: number }> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    // Reject segments arriving more than 30 seconds after call has ended (INT-05)
    if (call.endedAt) {
      const elapsedMs = Date.now() - call.endedAt.getTime();
      if (elapsedMs > 30 * 1000) {
        throw new ConflictException(
          'Call has been ended for more than 30 seconds; transcripts no longer accepted',
        );
      }
    }

    if (segments.length === 0) {
      return { inserted: 0 };
    }

    // Batch insert with skipDuplicates on (callId, segmentId) (INT-03)
    const result = await this.prisma.transcriptSegment.createMany({
      data: segments.map((s) => ({
        callId,
        segmentId: s.segmentId,
        role: s.role,
        text: s.text,
        sequence: s.sequence,
        spokenAt: new Date(s.spokenAt),
      })),
      skipDuplicates: true,
    });

    return { inserted: result.count };
  }

  async ingestMetrics(
    callId: string,
    metrics: IngestTurnMetricDto[],
  ): Promise<{ inserted: number }> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    if (metrics.length === 0) {
      return { inserted: 0 };
    }

    const result = await this.prisma.turnMetric.createMany({
      data: metrics.map((m) => ({
        callId,
        turnIndex: m.turnIndex,
        eouDelayMs: m.eouDelayMs ?? null,
        sttMs: m.sttMs ?? null,
        llmTtftMs: m.llmTtftMs ?? null,
        ttsTtfbMs: m.ttsTtfbMs ?? null,
        totalMs: m.totalMs ?? null,
      })),
    });

    // Update aggregate latency metrics on the Call record if any totalMs present
    try {
      const allTurnMetrics = await this.prisma.turnMetric.findMany({
        where: {
          callId,
          totalMs: { not: null },
        },
        select: { totalMs: true },
        orderBy: { totalMs: 'asc' },
      });

      if (allTurnMetrics.length > 0) {
        const values = allTurnMetrics.map((m) => m.totalMs as number);
        const sum = values.reduce((acc, v) => acc + v, 0);
        const avgLatencyMs = Math.round(sum / values.length);
        const p50LatencyMs = values[Math.floor(values.length * 0.5)] ?? null;
        const p95LatencyMs = values[Math.floor(values.length * 0.95)] ?? null;

        await this.prisma.call.update({
          where: { id: callId },
          data: {
            avgLatencyMs,
            p50LatencyMs,
            p95LatencyMs,
          },
        });
      }
    } catch (err) {
      this.logger.error(`Failed to update aggregate call latency: ${(err as Error).message}`);
    }

    return { inserted: result.count };
  }
}
