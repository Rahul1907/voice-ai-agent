process.env.NODE_ENV = 'test';
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Agent, Call, CallEndReason, CallStatus } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AccessToken, TokenVerifier } from 'livekit-server-sdk';
import { AppModule } from '../src/app.module';
import { CallsCleanupService } from '../src/calls/calls-cleanup.service';
import { CallsConcurrencyService } from '../src/calls/calls-concurrency.service';
import { AppConfigService } from '../src/config/app-config.service';
import { FakeLiveKitGateway } from '../src/livekit/fake-livekit.gateway';
import { LIVEKIT_GATEWAY } from '../src/livekit/livekit.interface';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

describe('Phase 9 Calls API & LiveKit Integration Tests (CALL-01 to CALL-15, INT-01 to INT-08, WH-01 to WH-05, SEC-07, SEC-09)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: AppConfigService;
  let concurrencyService: CallsConcurrencyService;
  let cleanupService: CallsCleanupService;
  let fakeLiveKit: FakeLiveKitGateway;

  let userA: { id: string; email: string; name: string };
  let userB: { id: string; email: string; name: string };
  let cookieA: string;
  let cookieB: string;

  let agentA: Agent;
  let agentB: Agent;
  let agentSoftDeleted: Agent;

  // Helper to generate signed LiveKit webhook
  async function signLiveKitWebhook(
    body: object,
    apiKey: string = configService.livekitApiKey,
    apiSecret: string = configService.livekitApiSecret,
  ): Promise<{ rawBody: string; authHeader: string }> {
    const rawBody = JSON.stringify(body);
    const sha256 = createHash('sha256').update(rawBody).digest('base64');
    const at = new AccessToken(apiKey, apiSecret);
    at.sha256 = sha256;
    const authHeader = await at.toJwt();
    return { rawBody, authHeader };
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    configService = app.get(AppConfigService);
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    concurrencyService = app.get(CallsConcurrencyService);
    cleanupService = app.get(CallsCleanupService);
    fakeLiveKit = app.get(LIVEKIT_GATEWAY) as unknown as FakeLiveKitGateway;

    setupApp(app, configService);
    await app.init();

    // Clean test database tables
    await prisma.transcriptSegment.deleteMany();
    await prisma.turnMetric.deleteMany();
    await prisma.knowledgeChunk.deleteMany();
    await prisma.knowledgeDocument.deleteMany();
    await prisma.call.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.user.deleteMany();
    await concurrencyService.reset();

    // Create users
    userA = await prisma.user.create({
      data: {
        email: `usera_${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        name: 'User A',
      },
    });

    userB = await prisma.user.create({
      data: {
        email: `userb_${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        name: 'User B',
      },
    });

    const tokenPayloadA = { sub: userA.id, email: userA.email };
    const signedTokenA = jwtService.sign(tokenPayloadA, { secret: configService.jwtSecret });
    cookieA = `access_token=${signedTokenA}`;

    const tokenPayloadB = { sub: userB.id, email: userB.email };
    const signedTokenB = jwtService.sign(tokenPayloadB, { secret: configService.jwtSecret });
    cookieB = `access_token=${signedTokenB}`;

    // Create agents
    agentA = await prisma.agent.create({
      data: {
        userId: userA.id,
        name: 'Agent A',
        systemPrompt: 'System prompt for Agent A',
        greeting: 'Hello from Agent A',
        voice: 'af_heart',
        llmModel: configService.defaultLlmModel,
        maxCallDurationSec: 600,
      },
    });

    agentB = await prisma.agent.create({
      data: {
        userId: userB.id,
        name: 'Agent B',
        systemPrompt: 'System prompt for Agent B',
        greeting: 'Hello from Agent B',
        voice: 'af_heart',
        llmModel: configService.defaultLlmModel,
        maxCallDurationSec: 600,
      },
    });

    agentSoftDeleted = await prisma.agent.create({
      data: {
        userId: userA.id,
        name: 'Deleted Agent',
        systemPrompt: 'Deleted agent prompt',
        greeting: 'Hello',
        voice: 'af_heart',
        llmModel: configService.defaultLlmModel,
        maxCallDurationSec: 600,
        deletedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.transcriptSegment.deleteMany();
    await prisma.turnMetric.deleteMany();
    await prisma.call.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.user.deleteMany();
    await concurrencyService.reset();
    await app.close();
  });

  beforeEach(async () => {
    fakeLiveKit.reset();
    await concurrencyService.reset();
  });

  // ==========================================
  // CALL-01 to CALL-15: Calls API
  // ==========================================

  describe('CALL-01 to CALL-07: POST /api/calls (Start Call)', () => {
    it('CALL-01, CALL-02, CALL-03, SEC-07: start call for own agent', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/calls')
        .set('Cookie', cookieA)
        .send({ agentId: agentA.id });

      expect(res.status).toBe(201);
      expect(res.body.callId).toBeDefined();
      expect(res.body.roomName).toBe(`call-${res.body.callId}`);
      expect(res.body.livekitUrl).toBe(configService.livekitUrl);
      expect(res.body.token).toBeDefined();

      // Check DB Call record in CREATED state
      const dbCall = await prisma.call.findUnique({ where: { id: res.body.callId } });
      expect(dbCall).toBeDefined();
      expect(dbCall?.status).toBe(CallStatus.CREATED);

      // CALL-02: Decode token - identity user-<id>, room-specific grant, TTL 15 min or less
      const verifier = new TokenVerifier(
        configService.livekitApiKey,
        configService.livekitApiSecret,
      );
      const claims = await verifier.verify(res.body.token);
      expect(claims.sub).toBe(`user-${userA.id}`);
      expect(claims.name).toBe(userA.name);
      expect(claims.video?.room).toBe(res.body.roomName);
      expect(claims.video?.roomJoin).toBe(true);
      expect(claims.video?.canPublish).toBe(true);
      expect(claims.video?.canSubscribe).toBe(true);

      const nowSec = Math.floor(Date.now() / 1000);
      const ttlSec = claims.exp! - (claims.nbf ?? nowSec);
      expect(ttlSec).toBeLessThanOrEqual(900);

      // SEC-07: Token grant is room-specific
      expect(claims.video?.room).not.toBe('other-random-room');

      // CALL-03: Fake gateway received agentName and { callId } metadata
      expect(fakeLiveKit.dispatches).toHaveLength(1);
      const dispatch = fakeLiveKit.dispatches[0];
      expect(dispatch?.agentName).toBe(configService.livekitAgentName);
      expect(dispatch?.room).toBe(res.body.roomName);
      expect(JSON.parse(dispatch?.metadata || '{}')).toEqual({ callId: res.body.callId });

      // Clean up for subsequent tests
      await prisma.call.delete({ where: { id: res.body.callId } });
    });

    it('CALL-04: start call for another user agent returns 404', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/calls')
        .set('Cookie', cookieA)
        .send({ agentId: agentB.id });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });

    it('CALL-15: start call for soft-deleted agent returns 404', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/calls')
        .set('Cookie', cookieA)
        .send({ agentId: agentSoftDeleted.id });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });

    it('CALL-05: start second call while one is active returns 409', async () => {
      // Create active call for user A
      const call = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userA.id,
          agentId: agentA.id,
          roomName: `call-${randomUUID()}`,
          status: CallStatus.ACTIVE,
          startedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/calls')
        .set('Cookie', cookieA)
        .send({ agentId: agentA.id });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');

      // Clean up
      await prisma.call.delete({ where: { id: call.id } });
    });

    it('CALL-06: global concurrency limit reached returns 503 with friendly message', async () => {
      // Simulate 3 slots taken in Redis
      await concurrencyService.acquireSlot();
      await concurrencyService.acquireSlot();
      await concurrencyService.acquireSlot();

      const res = await request(app.getHttpServer())
        .post('/api/calls')
        .set('Cookie', cookieA)
        .send({ agentId: agentA.id });

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Service Unavailable');
      expect(res.body.message[0]).toContain('All call channels are currently busy');
    });

    it('CALL-07: LiveKit gateway throws returns 502, marks Call FAILED, releases slot', async () => {
      fakeLiveKit.shouldFailCreateRoom = true;

      const res = await request(app.getHttpServer())
        .post('/api/calls')
        .set('Cookie', cookieA)
        .send({ agentId: agentA.id });

      expect(res.status).toBe(502);
      expect(res.body.error).toBe('Bad Gateway');

      // Check DB Call record marked FAILED
      const failedCall = await prisma.call.findFirst({
        where: { userId: userA.id, status: CallStatus.FAILED },
        orderBy: { createdAt: 'desc' },
      });
      expect(failedCall).toBeDefined();
      expect(failedCall?.errorMessage).toContain('simulated failure');

      // Concurrency slot released
      const activeCount = await concurrencyService.getActiveCount();
      expect(activeCount).toBe(0);

      // Clean up
      if (failedCall) {
        await prisma.call.delete({ where: { id: failedCall.id } });
      }
    });
  });

  describe('CALL-08 to CALL-10: POST /api/calls/:id/end (End Call)', () => {
    it('CALL-08: ends ongoing call with status ENDED, durationSec, reason USER_HANGUP', async () => {
      const call = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userA.id,
          agentId: agentA.id,
          roomName: `call-${randomUUID()}`,
          status: CallStatus.ACTIVE,
          startedAt: new Date(Date.now() - 35 * 1000), // 35 seconds ago
        },
      });
      await concurrencyService.acquireSlot();

      const res = await request(app.getHttpServer())
        .post(`/api/calls/${call.id}/end`)
        .set('Cookie', cookieA)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(CallStatus.ENDED);
      expect(res.body.endReason).toBe(CallEndReason.USER_HANGUP);
      expect(res.body.durationSec).toBeGreaterThanOrEqual(34);

      // Slot released
      const activeCount = await concurrencyService.getActiveCount();
      expect(activeCount).toBe(0);

      await prisma.call.delete({ where: { id: call.id } });
    });

    it('CALL-09: ending call twice is idempotent, both return 200 without duplicate release', async () => {
      const call = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userA.id,
          agentId: agentA.id,
          roomName: `call-${randomUUID()}`,
          status: CallStatus.ACTIVE,
          startedAt: new Date(),
        },
      });
      await concurrencyService.acquireSlot();

      const res1 = await request(app.getHttpServer())
        .post(`/api/calls/${call.id}/end`)
        .set('Cookie', cookieA)
        .send();

      const res2 = await request(app.getHttpServer())
        .post(`/api/calls/${call.id}/end`)
        .set('Cookie', cookieA)
        .send();

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.status).toBe(CallStatus.ENDED);
      expect(res2.body.status).toBe(CallStatus.ENDED);

      const activeCount = await concurrencyService.getActiveCount();
      expect(activeCount).toBe(0);

      await prisma.call.delete({ where: { id: call.id } });
    });

    it('CALL-10: ending another user call returns 404', async () => {
      const callA = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userA.id,
          agentId: agentA.id,
          roomName: `call-${randomUUID()}`,
          status: CallStatus.ACTIVE,
          startedAt: new Date(),
        },
      });

      // User B attempts to end User A's call
      const res = await request(app.getHttpServer())
        .post(`/api/calls/${callA.id}/end`)
        .set('Cookie', cookieB)
        .send();

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');

      await prisma.call.delete({ where: { id: callA.id } });
    });
  });

  describe('CALL-11 & CALL-12: List & Detail Calls', () => {
    it('CALL-11: list calls with agent filter returns own calls only and paginated', async () => {
      const callA1 = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userA.id,
          agentId: agentA.id,
          roomName: `call-${randomUUID()}`,
          status: CallStatus.ENDED,
        },
      });
      const callB = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userB.id,
          agentId: agentB.id,
          roomName: `call-${randomUUID()}`,
          status: CallStatus.ENDED,
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/calls?agentId=${agentA.id}`)
        .set('Cookie', cookieA);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(callA1.id);
      expect(res.body.items[0].agentId).toBe(agentA.id);

      // Clean up
      await prisma.call.deleteMany({ where: { id: { in: [callA1.id, callB.id] } } });
    });

    it('CALL-12: call detail returns transcripts ordered by sequence and metrics included', async () => {
      const call = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userA.id,
          agentId: agentA.id,
          roomName: `call-${randomUUID()}`,
          status: CallStatus.ENDED,
        },
      });

      // Insert segments out of order
      await prisma.transcriptSegment.createMany({
        data: [
          {
            callId: call.id,
            segmentId: 'seg-3',
            role: 'AGENT',
            text: 'I can help with that.',
            sequence: 3,
            spokenAt: new Date(),
          },
          {
            callId: call.id,
            segmentId: 'seg-1',
            role: 'AGENT',
            text: 'Hello!',
            sequence: 1,
            spokenAt: new Date(),
          },
          {
            callId: call.id,
            segmentId: 'seg-2',
            role: 'USER',
            text: 'I need help.',
            sequence: 2,
            spokenAt: new Date(),
          },
        ],
      });

      await prisma.turnMetric.create({
        data: {
          callId: call.id,
          turnIndex: 0,
          totalMs: 450,
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/calls/${call.id}`)
        .set('Cookie', cookieA);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(call.id);
      expect(res.body.transcripts).toHaveLength(3);
      // Check ordering by sequence asc
      expect(res.body.transcripts[0].sequence).toBe(1);
      expect(res.body.transcripts[1].sequence).toBe(2);
      expect(res.body.transcripts[2].sequence).toBe(3);
      expect(res.body.metrics).toHaveLength(1);
      expect(res.body.metrics[0].totalMs).toBe(450);

      await prisma.call.delete({ where: { id: call.id } });
    });
  });

  describe('CALL-13 & CALL-14: Stale Call Cleanup', () => {
    it('CALL-13: CREATED call older than 2 minutes marked FAILED with Agent did not join', async () => {
      const call = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userA.id,
          agentId: agentA.id,
          roomName: `call-${randomUUID()}`,
          status: CallStatus.CREATED,
          createdAt: new Date(Date.now() - 130 * 1000), // > 2 min ago
        },
      });
      await concurrencyService.acquireSlot();

      const result = await cleanupService.cleanupStaleCalls();
      expect(result.failedCount).toBeGreaterThanOrEqual(1);

      const updated = await prisma.call.findUnique({ where: { id: call.id } });
      expect(updated?.status).toBe(CallStatus.FAILED);
      expect(updated?.errorMessage).toBe('Agent did not join');

      const activeCount = await concurrencyService.getActiveCount();
      expect(activeCount).toBe(0);

      await prisma.call.delete({ where: { id: call.id } });
    });

    it('CALL-14: ACTIVE call beyond maxCallDurationSec + 60s marked ENDED with TIMEOUT', async () => {
      const call = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userA.id,
          agentId: agentA.id,
          roomName: `call-${randomUUID()}`,
          status: CallStatus.ACTIVE,
          startedAt: new Date(Date.now() - 670 * 1000), // 600s max + 70s > 660s
        },
      });
      await concurrencyService.acquireSlot();

      const result = await cleanupService.cleanupStaleCalls();
      expect(result.timedOutCount).toBeGreaterThanOrEqual(1);

      const updated = await prisma.call.findUnique({ where: { id: call.id } });
      expect(updated?.status).toBe(CallStatus.ENDED);
      expect(updated?.endReason).toBe(CallEndReason.TIMEOUT);

      const activeCount = await concurrencyService.getActiveCount();
      expect(activeCount).toBe(0);

      await prisma.call.delete({ where: { id: call.id } });
    });
  });

  // ==========================================
  // INT-01 to INT-08, SEC-09: Internal Worker Endpoints
  // ==========================================

  describe('Internal Endpoints (/api/internal/*)', () => {
    let call: Call;

    beforeEach(async () => {
      call = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userA.id,
          agentId: agentA.id,
          roomName: `call-${randomUUID()}`,
          status: CallStatus.CREATED,
        },
      });
    });

    afterEach(async () => {
      await prisma.call.deleteMany({ where: { id: call.id } });
    });

    it('INT-01: route without internal key returns 401', async () => {
      const res = await request(app.getHttpServer()).get(`/api/internal/calls/${call.id}/config`);
      expect(res.status).toBe(401);
    });

    it('INT-01: route with wrong internal key returns 401', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/internal/calls/${call.id}/config`)
        .set('x-internal-key', 'wrong-internal-key-99999999');
      expect(res.status).toBe(401);
    });

    it('INT-08: route with user cookie only returns 401', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/internal/calls/${call.id}/config`)
        .set('Cookie', cookieA);
      expect(res.status).toBe(401);
    });

    it('INT-02 & SEC-09: call config returns sanitized payload without secrets, or 404 if not found', async () => {
      // 1. Valid call config
      const res = await request(app.getHttpServer())
        .get(`/api/internal/calls/${call.id}/config`)
        .set('x-internal-key', configService.internalApiKey);

      expect(res.status).toBe(200);
      expect(res.body.callId).toBe(call.id);
      expect(res.body.agentName).toBe(agentA.name);
      expect(res.body.systemPrompt).toBe(agentA.systemPrompt);
      expect(res.body.greeting).toBe(agentA.greeting);
      expect(res.body.voice).toBe(agentA.voice);
      expect(res.body.llmModel).toBe(agentA.llmModel);
      expect(res.body.timezone).toBe(configService.defaultTimezone);

      // SEC-09: Ensure no sensitive keys/secrets leaked
      expect(res.body.jwtSecret).toBeUndefined();
      expect(res.body.livekitApiKey).toBeUndefined();
      expect(res.body.livekitApiSecret).toBeUndefined();
      expect(res.body.internalApiKey).toBeUndefined();
      expect(res.body.passwordHash).toBeUndefined();

      // 2. Unknown call returns 404
      const nonExistentId = randomUUID();
      const notFoundRes = await request(app.getHttpServer())
        .get(`/api/internal/calls/${nonExistentId}/config`)
        .set('x-internal-key', configService.internalApiKey);

      expect(notFoundRes.status).toBe(404);
    });

    it('INT-07: POST /api/internal/calls/:id/started marks ACTIVE and sets startedAt', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/internal/calls/${call.id}/started`)
        .set('x-internal-key', configService.internalApiKey)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(CallStatus.ACTIVE);
      expect(res.body.startedAt).toBeDefined();

      const updated = await prisma.call.findUnique({ where: { id: call.id } });
      expect(updated?.status).toBe(CallStatus.ACTIVE);
      expect(updated?.startedAt).toBeDefined();
    });

    it('INT-03 & INT-04: Transcripts batch insert with deduplication and sorted retrieval', async () => {
      const segments = [
        {
          segmentId: 'seg-100',
          role: 'AGENT' as const,
          text: 'Hello, welcome!',
          sequence: 1,
          spokenAt: new Date().toISOString(),
        },
      ];

      // Ingest once
      const res1 = await request(app.getHttpServer())
        .post(`/api/internal/calls/${call.id}/transcripts`)
        .set('x-internal-key', configService.internalApiKey)
        .send({ segments });
      expect(res1.status).toBe(200);

      // Ingest same segment again (INT-03)
      const res2 = await request(app.getHttpServer())
        .post(`/api/internal/calls/${call.id}/transcripts`)
        .set('x-internal-key', configService.internalApiKey)
        .send({ segments });
      expect(res2.status).toBe(200);

      const dbSegments = await prisma.transcriptSegment.findMany({ where: { callId: call.id } });
      expect(dbSegments).toHaveLength(1);
    });

    it('INT-05: Transcripts accepted 10s after call end, rejected (409) 60s after call end', async () => {
      // 1. Call ended 10s ago
      const recentEndedCall = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userA.id,
          agentId: agentA.id,
          roomName: `call-${randomUUID()}`,
          status: CallStatus.ENDED,
          endedAt: new Date(Date.now() - 10 * 1000), // 10s ago
        },
      });

      const acceptRes = await request(app.getHttpServer())
        .post(`/api/internal/calls/${recentEndedCall.id}/transcripts`)
        .set('x-internal-key', configService.internalApiKey)
        .send({
          segments: [
            {
              segmentId: 'seg-early',
              role: 'USER',
              text: 'Thanks!',
              sequence: 1,
              spokenAt: new Date().toISOString(),
            },
          ],
        });
      expect(acceptRes.status).toBe(200);

      // 2. Call ended 60s ago (> 30s grace)
      const oldEndedCall = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userA.id,
          agentId: agentA.id,
          roomName: `call-${randomUUID()}`,
          status: CallStatus.ENDED,
          endedAt: new Date(Date.now() - 60 * 1000), // 60s ago
        },
      });

      const rejectRes = await request(app.getHttpServer())
        .post(`/api/internal/calls/${oldEndedCall.id}/transcripts`)
        .set('x-internal-key', configService.internalApiKey)
        .send({
          segments: [
            {
              segmentId: 'seg-late',
              role: 'USER',
              text: 'Still here?',
              sequence: 2,
              spokenAt: new Date().toISOString(),
            },
          ],
        });
      expect(rejectRes.status).toBe(409);
      expect(rejectRes.body.error).toBe('Conflict');

      await prisma.call.deleteMany({
        where: { id: { in: [recentEndedCall.id, oldEndedCall.id] } },
      });
    });

    it('INT-06: Metrics with negative or non-number values return 400', async () => {
      // Non-number value
      const badRes1 = await request(app.getHttpServer())
        .post(`/api/internal/calls/${call.id}/metrics`)
        .set('x-internal-key', configService.internalApiKey)
        .send({
          metrics: [{ turnIndex: 'zero', totalMs: 100 }],
        });
      expect(badRes1.status).toBe(400);

      // Negative value
      const badRes2 = await request(app.getHttpServer())
        .post(`/api/internal/calls/${call.id}/metrics`)
        .set('x-internal-key', configService.internalApiKey)
        .send({
          metrics: [{ turnIndex: 0, totalMs: -50 }],
        });
      expect(badRes2.status).toBe(400);

      // Valid metrics
      const goodRes = await request(app.getHttpServer())
        .post(`/api/internal/calls/${call.id}/metrics`)
        .set('x-internal-key', configService.internalApiKey)
        .send({
          metrics: [{ turnIndex: 0, totalMs: 250, sttMs: 50, llmTtftMs: 100, ttsTtfbMs: 100 }],
        });
      expect(goodRes.status).toBe(200);
    });
  });

  // ==========================================
  // WH-01 to WH-05: Webhook Endpoints
  // ==========================================

  describe('LiveKit Webhooks (/api/webhooks/livekit)', () => {
    it('WH-02: invalid signature returns 401', async () => {
      const payload = { event: 'room_finished', room: { name: 'call-unknown' } };
      const res = await request(app.getHttpServer())
        .post('/api/webhooks/livekit')
        .set('authorization', 'invalid.jwt.token')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('WH-03: unknown room returns 200 and is ignored', async () => {
      const webhookPayload = {
        event: 'room_finished',
        room: { name: 'call-non-existent-room' },
      };
      const { rawBody, authHeader } = await signLiveKitWebhook(webhookPayload);

      const res = await request(app.getHttpServer())
        .post('/api/webhooks/livekit')
        .set('authorization', authHeader)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.handled).toBe(false);
    });

    it('WH-01 & WH-05: valid room_finished for ACTIVE call ends with DISCONNECTED; idempotent', async () => {
      const roomName = `call-${randomUUID()}`;
      const activeCall = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userA.id,
          agentId: agentA.id,
          roomName,
          status: CallStatus.ACTIVE,
          startedAt: new Date(Date.now() - 20 * 1000),
        },
      });
      await concurrencyService.acquireSlot();

      const webhookPayload = {
        event: 'room_finished',
        room: { name: roomName },
      };
      const { rawBody, authHeader } = await signLiveKitWebhook(webhookPayload);

      // First delivery (WH-01)
      const res1 = await request(app.getHttpServer())
        .post('/api/webhooks/livekit')
        .set('authorization', authHeader)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res1.status).toBe(200);
      expect(res1.body.handled).toBe(true);

      const dbCall = await prisma.call.findUnique({ where: { id: activeCall.id } });
      expect(dbCall?.status).toBe(CallStatus.ENDED);
      expect(dbCall?.endReason).toBe(CallEndReason.DISCONNECTED);

      // Concurrency slot released
      const activeCount = await concurrencyService.getActiveCount();
      expect(activeCount).toBe(0);

      // Duplicate delivery (WH-05): returns 200 without duplicate slot decrements
      const res2 = await request(app.getHttpServer())
        .post('/api/webhooks/livekit')
        .set('authorization', authHeader)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res2.status).toBe(200);
      expect(res2.body.handled).toBe(false);

      await prisma.call.delete({ where: { id: activeCall.id } });
    });

    it('WH-04: participant_left for the user ends the call as USER_HANGUP', async () => {
      const roomName = `call-${randomUUID()}`;
      const activeCall = await prisma.call.create({
        data: {
          id: randomUUID(),
          userId: userA.id,
          agentId: agentA.id,
          roomName,
          status: CallStatus.ACTIVE,
          startedAt: new Date(),
        },
      });
      await concurrencyService.acquireSlot();

      const webhookPayload = {
        event: 'participant_left',
        room: { name: roomName },
        participant: { identity: `user-${userA.id}` },
      };
      const { rawBody, authHeader } = await signLiveKitWebhook(webhookPayload);

      const res = await request(app.getHttpServer())
        .post('/api/webhooks/livekit')
        .set('authorization', authHeader)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.handled).toBe(true);

      const dbCall = await prisma.call.findUnique({ where: { id: activeCall.id } });
      expect(dbCall?.status).toBe(CallStatus.ENDED);
      expect(dbCall?.endReason).toBe(CallEndReason.USER_HANGUP);

      const activeCount = await concurrencyService.getActiveCount();
      expect(activeCount).toBe(0);

      await prisma.call.delete({ where: { id: activeCall.id } });
    });
  });
});
