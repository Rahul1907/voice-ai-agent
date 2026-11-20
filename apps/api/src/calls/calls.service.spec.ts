import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CallEndReason, CallStatus } from '@prisma/client';
import { TokenVerifier } from 'livekit-server-sdk';
import { AppConfigService } from '../config/app-config.service';
import { FakeLiveKitGateway } from '../livekit/fake-livekit.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { CallsCleanupService } from './calls-cleanup.service';
import { CallsConcurrencyService } from './calls-concurrency.service';
import { CallsService } from './calls.service';

describe('CallsService (Unit Tests)', () => {
  let service: CallsService;
  let cleanupService: CallsCleanupService;
  let fakeGateway: FakeLiveKitGateway;
  let prisma: {
    agent: {
      findFirst: jest.Mock;
    };
    call: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };
  let concurrency: {
    acquireSlot: jest.Mock;
    releaseSlot: jest.Mock;
    getActiveCount: jest.Mock;
  };
  let config: Partial<AppConfigService>;

  const user = { id: '11111111-1111-1111-1111-111111111111', name: 'Test User' };
  const mockAgent = {
    id: '22222222-2222-2222-2222-222222222222',
    userId: user.id,
    name: 'Voice Assistant',
    systemPrompt: 'You are helpful.',
    greeting: 'Hi there!',
    voice: 'af_heart',
    maxCallDurationSec: 600,
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = {
      agent: {
        findFirst: jest.fn(),
      },
      call: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    concurrency = {
      acquireSlot: jest.fn().mockResolvedValue(true),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
      getActiveCount: jest.fn().mockResolvedValue(0),
    };

    config = {
      livekitUrl: 'http://localhost:7880',
      livekitApiKey: 'devkey',
      livekitApiSecret: 'secret123456789012345678901234567890',
      livekitAgentName: 'voice-agent',
      maxConcurrentCalls: 3,
    };

    fakeGateway = new FakeLiveKitGateway(config as AppConfigService);
    service = new CallsService(
      prisma as unknown as PrismaService,
      config as AppConfigService,
      concurrency as unknown as CallsConcurrencyService,
      fakeGateway,
    );
    cleanupService = new CallsCleanupService(
      prisma as unknown as PrismaService,
      concurrency as unknown as CallsConcurrencyService,
      fakeGateway,
    );
  });

  describe('startCall', () => {
    it('CALL-01 & CALL-03: starts call, creates room, dispatches agent with metadata', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.call.findFirst.mockResolvedValue(null);
      prisma.call.create.mockImplementation((args) =>
        Promise.resolve({
          ...args.data,
          createdAt: new Date(),
          startedAt: null,
          endedAt: null,
          durationSec: null,
          summary: null,
          summaryStatus: 'PENDING',
          avgLatencyMs: null,
          p50LatencyMs: null,
          p95LatencyMs: null,
        }),
      );

      const res = await service.startCall(user, { agentId: mockAgent.id });

      expect(res.callId).toBeDefined();
      expect(res.roomName).toBe(`call-${res.callId}`);
      expect(res.livekitUrl).toBe(config.livekitUrl);
      expect(res.token).toBeDefined();

      // CALL-03: Fake gateway received agentName and { callId } metadata
      expect(fakeGateway.dispatches).toHaveLength(1);
      const dispatch = fakeGateway.dispatches[0];
      expect(dispatch?.agentName).toBe('voice-agent');
      expect(dispatch?.room).toBe(`call-${res.callId}`);
      expect(JSON.parse(dispatch?.metadata || '{}')).toEqual({ callId: res.callId });
    });

    it('CALL-02: decodes token with identity user-<id>, room-specific grant, TTL 15 min or less', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.call.findFirst.mockResolvedValue(null);
      prisma.call.create.mockImplementation((args) =>
        Promise.resolve({
          ...args.data,
          createdAt: new Date(),
          startedAt: null,
          endedAt: null,
          durationSec: null,
          summary: null,
          summaryStatus: 'PENDING',
          avgLatencyMs: null,
          p50LatencyMs: null,
          p95LatencyMs: null,
        }),
      );

      const res = await service.startCall(user, { agentId: mockAgent.id });

      const verifier = new TokenVerifier(config.livekitApiKey!, config.livekitApiSecret!);
      const claims = await verifier.verify(res.token);

      expect(claims.sub).toBe(`user-${user.id}`);
      expect(claims.name).toBe(user.name);
      expect(claims.video?.room).toBe(res.roomName);
      expect(claims.video?.roomJoin).toBe(true);

      const nowSec = Math.floor(Date.now() / 1000);
      const expSec = claims.exp!;
      const ttlSec = expSec - (claims.nbf ?? nowSec);
      expect(ttlSec).toBeLessThanOrEqual(900); // <= 15 minutes
    });

    it('SEC-07: token grant is room-specific (room A token cannot be used for room B)', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.call.findFirst.mockResolvedValue(null);
      prisma.call.create.mockImplementation((args) =>
        Promise.resolve({
          ...args.data,
          createdAt: new Date(),
          startedAt: null,
          endedAt: null,
          durationSec: null,
          summary: null,
          summaryStatus: 'PENDING',
          avgLatencyMs: null,
          p50LatencyMs: null,
          p95LatencyMs: null,
        }),
      );

      const res = await service.startCall(user, { agentId: mockAgent.id });
      const verifier = new TokenVerifier(config.livekitApiKey!, config.livekitApiSecret!);
      const claims = await verifier.verify(res.token);

      expect(claims.video?.room).toBe(res.roomName);
      expect(claims.video?.room).not.toBe('other-room-123');
    });

    it('CALL-04: throws 404 if agent belongs to another user', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(service.startCall(user, { agentId: 'other-agent' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('CALL-15: throws 404 if agent is soft-deleted', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(service.startCall(user, { agentId: mockAgent.id })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('CALL-05: throws 409 if user already has an active or created call', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.call.findFirst.mockResolvedValue({ id: 'existing-call', status: CallStatus.ACTIVE });

      await expect(service.startCall(user, { agentId: mockAgent.id })).rejects.toThrow(
        ConflictException,
      );
    });

    it('CALL-06: throws 503 if global concurrency limit reached', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.call.findFirst.mockResolvedValue(null);
      concurrency.acquireSlot.mockResolvedValue(false);

      await expect(service.startCall(user, { agentId: mockAgent.id })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('CALL-07: throws 502, marks Call FAILED, releases slot if LiveKit fails', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.call.findFirst.mockResolvedValue(null);
      prisma.call.create.mockImplementation((args) =>
        Promise.resolve({
          ...args.data,
          id: 'failed-call-id',
          createdAt: new Date(),
        }),
      );

      fakeGateway.shouldFailCreateRoom = true;

      await expect(service.startCall(user, { agentId: mockAgent.id })).rejects.toThrow(
        BadGatewayException,
      );

      expect(prisma.call.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'failed-call-id' },
          data: expect.objectContaining({
            status: CallStatus.FAILED,
          }),
        }),
      );
      expect(concurrency.releaseSlot).toHaveBeenCalled();
    });
  });

  describe('endCall', () => {
    it('CALL-08: sets status ENDED, calculates durationSec, sets USER_HANGUP reason', async () => {
      const startedAt = new Date(Date.now() - 45 * 1000);
      const activeCall = {
        id: 'call-1',
        userId: user.id,
        roomName: 'call-call-1',
        status: CallStatus.ACTIVE,
        startedAt,
        agent: { id: mockAgent.id, name: mockAgent.name, voice: mockAgent.voice },
      };

      prisma.call.findFirst.mockResolvedValue(activeCall);
      prisma.call.update.mockImplementation((args) =>
        Promise.resolve({
          ...activeCall,
          ...args.data,
          createdAt: startedAt,
          summary: null,
          summaryStatus: 'PENDING',
          avgLatencyMs: null,
          p50LatencyMs: null,
          p95LatencyMs: null,
        }),
      );

      const res = await service.endCall('call-1', user.id);

      expect(res.status).toBe(CallStatus.ENDED);
      expect(res.endReason).toBe(CallEndReason.USER_HANGUP);
      expect(res.durationSec).toBeGreaterThanOrEqual(44);
      expect(concurrency.releaseSlot).toHaveBeenCalled();
      expect(fakeGateway.deletedRooms.has('call-call-1')).toBe(true);
    });

    it('CALL-09: ending call twice is idempotent, both return 200 without second release', async () => {
      const endedCall = {
        id: 'call-1',
        userId: user.id,
        roomName: 'call-call-1',
        status: CallStatus.ENDED,
        endReason: CallEndReason.USER_HANGUP,
        durationSec: 30,
        createdAt: new Date(),
        startedAt: new Date(),
        endedAt: new Date(),
        summary: null,
        summaryStatus: 'PENDING',
        avgLatencyMs: null,
        p50LatencyMs: null,
        p95LatencyMs: null,
        agent: { id: mockAgent.id, name: mockAgent.name, voice: mockAgent.voice },
      };

      prisma.call.findFirst.mockResolvedValue(endedCall);

      const res1 = await service.endCall('call-1', user.id);
      const res2 = await service.endCall('call-1', user.id);

      expect(res1.status).toBe(CallStatus.ENDED);
      expect(res2.status).toBe(CallStatus.ENDED);
      expect(prisma.call.update).not.toHaveBeenCalled();
      expect(concurrency.releaseSlot).not.toHaveBeenCalled();
    });

    it('CALL-10: throws 404 when ending another user call', async () => {
      prisma.call.findFirst.mockResolvedValue(null);

      await expect(service.endCall('foreign-call', user.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cleanupStaleCalls', () => {
    it('CALL-13: marks CREATED calls older than 2 min as FAILED with Agent did not join', async () => {
      const oldDate = new Date(Date.now() - 130 * 1000);
      const staleCalls = [
        {
          id: 'stale-created-1',
          roomName: 'call-stale-created-1',
          status: CallStatus.CREATED,
          createdAt: oldDate,
        },
      ];

      prisma.call.findMany
        .mockResolvedValueOnce(staleCalls) // CREATED check
        .mockResolvedValueOnce([]); // ACTIVE check

      const result = await cleanupService.cleanupStaleCalls();

      expect(result.failedCount).toBe(1);
      expect(prisma.call.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stale-created-1' },
          data: expect.objectContaining({
            status: CallStatus.FAILED,
            errorMessage: 'Agent did not join',
          }),
        }),
      );
      expect(concurrency.releaseSlot).toHaveBeenCalled();
    });

    it('CALL-14: marks ACTIVE calls beyond maxCallDurationSec + 60s as ENDED with TIMEOUT', async () => {
      const startedAt = new Date(Date.now() - 700 * 1000); // 700s ago
      const activeCall = {
        id: 'active-timed-out',
        roomName: 'call-active-timed-out',
        status: CallStatus.ACTIVE,
        startedAt,
        agent: { maxCallDurationSec: 600 },
      };

      prisma.call.findMany
        .mockResolvedValueOnce([]) // CREATED check
        .mockResolvedValueOnce([activeCall]); // ACTIVE check

      const result = await cleanupService.cleanupStaleCalls();

      expect(result.timedOutCount).toBe(1);
      expect(prisma.call.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'active-timed-out' },
          data: expect.objectContaining({
            status: CallStatus.ENDED,
            endReason: CallEndReason.TIMEOUT,
          }),
        }),
      );
      expect(concurrency.releaseSlot).toHaveBeenCalled();
    });
  });
});
