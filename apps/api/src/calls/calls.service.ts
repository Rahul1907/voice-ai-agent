import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Call, CallEndReason, CallStatus, Prisma } from '@prisma/client';
import { PaginatedResponse } from '@voice-ai/shared';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../config/app-config.service';
import { LIVEKIT_GATEWAY, LiveKitGateway } from '../livekit/livekit.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CallsConcurrencyService } from './calls-concurrency.service';
import {
  CallDetailResponseDto,
  CallResponseDto,
  StartCallResponseDto,
} from './dto/call-response.dto';
import { CreateCallDto } from './dto/create-call.dto';
import { ListCallsQueryDto } from './dto/list-calls-query.dto';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly concurrency: CallsConcurrencyService,
    @Inject(LIVEKIT_GATEWAY)
    private readonly livekitGateway: LiveKitGateway,
  ) {}

  async startCall(
    user: { id: string; name: string },
    dto: CreateCallDto,
  ): Promise<StartCallResponseDto> {
    // 1. Verify agent ownership and soft-delete status
    const agent = await this.prisma.agent.findFirst({
      where: {
        id: dto.agentId,
        userId: user.id,
        deletedAt: null,
      },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // 2. Ensure user has no ACTIVE or CREATED call
    const activeCall = await this.prisma.call.findFirst({
      where: {
        userId: user.id,
        status: {
          in: [CallStatus.CREATED, CallStatus.ACTIVE],
        },
      },
    });

    if (activeCall) {
      throw new ConflictException('You already have an active call in progress.');
    }

    // 3. Enforce global concurrency limit via Redis counter
    const slotAcquired = await this.concurrency.acquireSlot();
    if (!slotAcquired) {
      throw new ServiceUnavailableException(
        'All call channels are currently busy. Please try again shortly.',
      );
    }

    // 4. Create Call record in CREATED state
    const callId = randomUUID();
    const roomName = `call-${callId}`;

    let call: Call;
    try {
      call = await this.prisma.call.create({
        data: {
          id: callId,
          userId: user.id,
          agentId: agent.id,
          roomName,
          status: CallStatus.CREATED,
        },
      });
    } catch (err) {
      await this.concurrency.releaseSlot();
      this.logger.error(`Failed to create Call record in database: ${(err as Error).message}`);
      throw err;
    }

    // 5. Create LiveKit room, dispatch agent, and issue user token
    try {
      await this.livekitGateway.createRoom({
        name: roomName,
        emptyTimeout: 300,
      });

      await this.livekitGateway.dispatchAgent({
        room: roomName,
        agentName: this.config.livekitAgentName,
        metadata: JSON.stringify({ callId: call.id }),
      });

      const token = await this.livekitGateway.createToken({
        identity: `user-${user.id}`,
        name: user.name,
        room: roomName,
        ttl: '15m',
      });

      return {
        callId: call.id,
        roomName: call.roomName,
        token,
        livekitUrl: this.config.livekitUrl,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Voice provider error';
      this.logger.error(`LiveKit call initialization failed for call ${call.id}: ${errorMsg}`);

      // Mark call FAILED, release slot, return 502 Bad Gateway
      await this.prisma.call.update({
        where: { id: call.id },
        data: {
          status: CallStatus.FAILED,
          errorMessage: errorMsg,
          endedAt: new Date(),
        },
      });

      await this.concurrency.releaseSlot();

      throw new BadGatewayException('Failed to initialize call session with voice provider.');
    }
  }

  async endCall(callId: string, userId: string): Promise<CallResponseDto> {
    const call = await this.prisma.call.findFirst({
      where: { id: callId, userId },
      include: { agent: { select: { id: true, name: true, voice: true } } },
    });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    // Idempotent: If call is already ENDED or FAILED, return immediately
    if (call.status === CallStatus.ENDED || call.status === CallStatus.FAILED) {
      return this.toCallDto(call);
    }

    const endedAt = new Date();
    const durationSec = call.startedAt
      ? Math.max(0, Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000))
      : 0;

    const updated = await this.prisma.call.update({
      where: { id: call.id },
      data: {
        status: CallStatus.ENDED,
        endReason: CallEndReason.USER_HANGUP,
        endedAt,
        durationSec,
      },
      include: { agent: { select: { id: true, name: true, voice: true } } },
    });

    // Release Redis concurrency slot
    await this.concurrency.releaseSlot();

    // Clean up LiveKit room
    await this.livekitGateway.deleteRoom(call.roomName).catch((err) => {
      this.logger.warn(`Could not delete LiveKit room ${call.roomName}: ${(err as Error).message}`);
    });

    // Enqueue summary job hook (Phase 13 hook)
    await this.enqueueSummaryJob(call.id);

    return this.toCallDto(updated);
  }

  async listCalls(
    userId: string,
    query: ListCallsQueryDto,
  ): Promise<PaginatedResponse<CallResponseDto>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.CallWhereInput = {
      userId,
      ...(query.agentId ? { agentId: query.agentId } : {}),
    };

    const [calls, total] = await Promise.all([
      this.prisma.call.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          agent: { select: { id: true, name: true, voice: true } },
        },
      }),
      this.prisma.call.count({ where }),
    ]);

    return {
      items: calls.map((c) => this.toCallDto(c)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getCall(callId: string, userId: string): Promise<CallDetailResponseDto> {
    const call = await this.prisma.call.findFirst({
      where: { id: callId, userId },
      include: {
        agent: { select: { id: true, name: true, voice: true } },
        transcripts: {
          orderBy: { sequence: 'asc' },
        },
        metrics: {
          orderBy: { turnIndex: 'asc' },
        },
      },
    });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    return this.toCallDetailDto(call);
  }

  async enqueueSummaryJob(callId: string): Promise<void> {
    // Phase 13 will hook this up to BullMQ
    this.logger.debug(`Summary job hook triggered for call ${callId}`);
  }

  public toCallDto(
    call: Call & { agent?: { id: string; name: string; voice: string } | null },
  ): CallResponseDto {
    return {
      id: call.id,
      userId: call.userId,
      agentId: call.agentId,
      agentName: call.agent?.name,
      agent: call.agent
        ? { id: call.agent.id, name: call.agent.name, voice: call.agent.voice }
        : undefined,
      roomName: call.roomName,
      status: call.status,
      endReason: call.endReason,
      errorMessage: call.errorMessage,
      createdAt: call.createdAt.toISOString(),
      startedAt: call.startedAt ? call.startedAt.toISOString() : null,
      endedAt: call.endedAt ? call.endedAt.toISOString() : null,
      durationSec: call.durationSec,
      summary: call.summary,
      summaryStatus: call.summaryStatus,
      avgLatencyMs: call.avgLatencyMs,
      p50LatencyMs: call.p50LatencyMs,
      p95LatencyMs: call.p95LatencyMs,
    };
  }

  public toCallDetailDto(
    call: Call & {
      agent?: { id: string; name: string; voice: string } | null;
      transcripts: Array<{
        id: string;
        callId: string;
        segmentId: string;
        role: string;
        text: string;
        sequence: number;
        spokenAt: Date;
      }>;
      metrics: Array<{
        id: string;
        callId: string;
        turnIndex: number;
        eouDelayMs: number | null;
        sttMs: number | null;
        llmTtftMs: number | null;
        ttsTtfbMs: number | null;
        totalMs: number | null;
        createdAt: Date;
      }>;
    },
  ): CallDetailResponseDto {
    const base = this.toCallDto(call);
    return {
      ...base,
      transcripts: call.transcripts.map((t) => ({
        id: t.id,
        callId: t.callId,
        segmentId: t.segmentId,
        role: t.role as 'USER' | 'AGENT',
        text: t.text,
        sequence: t.sequence,
        spokenAt: t.spokenAt.toISOString(),
      })),
      metrics: call.metrics.map((m) => ({
        id: m.id,
        callId: m.callId,
        turnIndex: m.turnIndex,
        eouDelayMs: m.eouDelayMs,
        sttMs: m.sttMs,
        llmTtftMs: m.llmTtftMs,
        ttsTtfbMs: m.ttsTtfbMs,
        totalMs: m.totalMs,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }
}
