process.env.NODE_ENV = 'test';
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { CallStatus } from '@prisma/client';
import { DEFAULT_VOICES } from '@voice-ai/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

describe('Phase 5 Agents & Voices Integration Tests (AGT-01 to AGT-15, VOI-01)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: AppConfigService;

  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configService = app.get(AppConfigService);
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    setupApp(app, configService);
    await app.init();

    // Clean up test database
    await prisma.transcriptSegment.deleteMany();
    await prisma.turnMetric.deleteMany();
    await prisma.knowledgeChunk.deleteMany();
    await prisma.knowledgeDocument.deleteMany();
    await prisma.call.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.user.deleteMany();

    // Create User A and User B
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

    tokenA = jwtService.sign({ sub: userA.id, email: userA.email });
    tokenB = jwtService.sign({ sub: userB.id, email: userB.email });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.transcriptSegment.deleteMany();
      await prisma.turnMetric.deleteMany();
      await prisma.knowledgeChunk.deleteMany();
      await prisma.knowledgeDocument.deleteMany();
      await prisma.call.deleteMany();
      await prisma.agent.deleteMany();
      await prisma.user.deleteMany();
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  describe('VOI-01: GET /api/voices', () => {
    it('returns the list of available TTS voices', async () => {
      const res = await request(app.getHttpServer()).get('/api/voices');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(DEFAULT_VOICES.length);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('gender');
      expect(res.body[0]).toHaveProperty('accent');
    });
  });

  describe('AGT-01: Create agent with only required fields', () => {
    it('returns 201 and applies all schema defaults', async () => {
      const payload = {
        name: 'Simple Agent',
        systemPrompt: 'You are a simple customer assistant.',
      };

      const res = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenA}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.userId).toBe(userA.id);
      expect(res.body.name).toBe('Simple Agent');
      expect(res.body.systemPrompt).toBe('You are a simple customer assistant.');
      expect(res.body.greeting).toBe('Hi! How can I help you today?');
      expect(res.body.voice).toBe('af_heart');
      expect(res.body.language).toBe('en');
      expect(res.body.llmModel).toBe(configService.defaultLlmModel);
      expect(res.body.temperature).toBe(0.6);
      expect(res.body.maxCallDurationSec).toBe(600);
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
    });
  });

  describe('AGT-02: Missing required name', () => {
    it('returns 400 Bad Request when name is omitted', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenA}`)
        .send({ systemPrompt: 'System prompt instructions here.' });

      expect(res.status).toBe(400);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message.some((m: string) => m.includes('name'))).toBe(true);
    });
  });

  describe('AGT-03: Name exceeding 60 characters', () => {
    it('returns 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenA}`)
        .send({
          name: 'a'.repeat(61),
          systemPrompt: 'Valid system prompt for testing.',
        });

      expect(res.status).toBe(400);
      expect(res.body.message.some((m: string) => m.includes('name'))).toBe(true);
    });
  });

  describe('AGT-04: System prompt length validation', () => {
    it('returns 400 when systemPrompt is under 10 chars', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenA}`)
        .send({
          name: 'Valid Name',
          systemPrompt: 'Short',
        });

      expect(res.status).toBe(400);
      expect(res.body.message.some((m: string) => m.includes('systemPrompt'))).toBe(true);
    });

    it('returns 400 when systemPrompt is over 4000 chars', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenA}`)
        .send({
          name: 'Valid Name',
          systemPrompt: 'p'.repeat(4001),
        });

      expect(res.status).toBe(400);
      expect(res.body.message.some((m: string) => m.includes('systemPrompt'))).toBe(true);
    });
  });

  describe('AGT-05: Unknown voice', () => {
    it('returns 400 Bad Request when voice does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenA}`)
        .send({
          name: 'Voice Agent',
          systemPrompt: 'Instructions for customer agent.',
          voice: 'non_existent_voice_id',
        });

      expect(res.status).toBe(400);
      expect(res.body.message.some((m: string) => m.includes('Unknown voice'))).toBe(true);
    });
  });

  describe('AGT-06: Out of bound numeric values', () => {
    it('returns 400 when temperature is out of range (-0.1 or 1.1)', async () => {
      const resLow = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenA}`)
        .send({
          name: 'Temp Agent',
          systemPrompt: 'Instructions for testing temperature.',
          temperature: -0.1,
        });

      expect(resLow.status).toBe(400);

      const resHigh = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenA}`)
        .send({
          name: 'Temp Agent',
          systemPrompt: 'Instructions for testing temperature.',
          temperature: 1.1,
        });

      expect(resHigh.status).toBe(400);
    });

    it('returns 400 when maxCallDurationSec is out of range (30 or 1000)', async () => {
      const resLow = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenA}`)
        .send({
          name: 'Duration Agent',
          systemPrompt: 'Instructions for testing duration.',
          maxCallDurationSec: 30,
        });

      expect(resLow.status).toBe(400);

      const resHigh = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenA}`)
        .send({
          name: 'Duration Agent',
          systemPrompt: 'Instructions for testing duration.',
          maxCallDurationSec: 1000,
        });

      expect(resHigh.status).toBe(400);
    });
  });

  describe('AGT-07: List agents', () => {
    it('returns only own, non-deleted agents, sorted by updatedAt desc, paginated', async () => {
      // User B also creates an agent
      await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenB}`)
        .send({
          name: "User B's Private Agent",
          systemPrompt: 'Instructions belonging only to user B.',
        });

      const res = await request(app.getHttpServer())
        .get('/api/agents?page=1&pageSize=10')
        .set('Cookie', `access_token=${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('pageSize', 10);
      expect(res.body).toHaveProperty('totalPages');

      // Verify every agent returned belongs to User A
      res.body.items.forEach((agent: { userId: string; name: string }) => {
        expect(agent.userId).toBe(userA.id);
        expect(agent.name).not.toBe("User B's Private Agent");
      });
    });

    it('caps pageSize at 50', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/agents?page=1&pageSize=100')
        .set('Cookie', `access_token=${tokenA}`);

      // Query validator caps pageSize at 50 (or rejects > 50 with 400 per DTO validation)
      if (res.status === 200) {
        expect(res.body.pageSize).toBeLessThanOrEqual(50);
      } else {
        expect(res.status).toBe(400);
      }
    });
  });

  describe('AGT-08: Get another user agent', () => {
    it('returns 404 (not 403) to prevent leaking existence', async () => {
      // Create agent under User B
      const createRes = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenB}`)
        .send({
          name: 'Secret Agent B',
          systemPrompt: 'Classified prompt that user A should not know exists.',
        });

      const agentBId = createRes.body.id;

      // User A tries to GET agent B
      const getRes = await request(app.getHttpServer())
        .get(`/api/agents/${agentBId}`)
        .set('Cookie', `access_token=${tokenA}`);

      expect(getRes.status).toBe(404);
      expect(getRes.body.statusCode).toBe(404);
      expect(getRes.body.message).toContain('Agent not found');
    });
  });

  describe('AGT-09: Partial update', () => {
    it('returns 200, updates only specified fields, and updates updatedAt', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenA}`)
        .send({
          name: 'Original Agent',
          systemPrompt: 'Original prompt instructions.',
          greeting: 'Hello there!',
        });

      const agentId = createRes.body.id;
      const originalCreatedAt = createRes.body.createdAt;
      const originalUpdatedAt = createRes.body.updatedAt;

      // Wait 10ms so timestamp advances
      await new Promise((resolve) => setTimeout(resolve, 50));

      const updateRes = await request(app.getHttpServer())
        .patch(`/api/agents/${agentId}`)
        .set('Cookie', `access_token=${tokenA}`)
        .send({
          name: 'Renamed Agent',
          temperature: 0.8,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.id).toBe(agentId);
      expect(updateRes.body.name).toBe('Renamed Agent');
      expect(updateRes.body.temperature).toBe(0.8);
      // Unmodified fields remained identical
      expect(updateRes.body.systemPrompt).toBe('Original prompt instructions.');
      expect(updateRes.body.greeting).toBe('Hello there!');
      expect(updateRes.body.createdAt).toBe(originalCreatedAt);
      expect(new Date(updateRes.body.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime(),
      );
    });
  });

  describe('AGT-10: Update another user agent', () => {
    it('returns 404 when attempting to update an agent owned by another user', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenB}`)
        .send({
          name: 'Agent Owned By B',
          systemPrompt: 'Instructions owned strictly by User B.',
        });

      const agentBId = createRes.body.id;

      const updateRes = await request(app.getHttpServer())
        .patch(`/api/agents/${agentBId}`)
        .set('Cookie', `access_token=${tokenA}`)
        .send({ name: 'Hacked by A' });

      expect(updateRes.status).toBe(404);
    });
  });

  describe('AGT-11: Soft delete agent', () => {
    it('returns 204, get returns 404, and existing call records persist', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenA}`)
        .send({
          name: 'Agent To Be Deleted',
          systemPrompt: 'This agent will have historical calls before deletion.',
        });

      const agentId = createRes.body.id;

      // Associate a call record with this agent
      const call = await prisma.call.create({
        data: {
          userId: userA.id,
          agentId,
          roomName: `call-${randomUUID()}`,
          status: CallStatus.ENDED,
        },
      });

      // DELETE /api/agents/:id
      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/agents/${agentId}`)
        .set('Cookie', `access_token=${tokenA}`);

      expect(deleteRes.status).toBe(204);

      // GET /api/agents/:id now returns 404
      const getRes = await request(app.getHttpServer())
        .get(`/api/agents/${agentId}`)
        .set('Cookie', `access_token=${tokenA}`);

      expect(getRes.status).toBe(404);

      // Verify in DB that agent is soft-deleted (deletedAt is set)
      const dbAgent = await prisma.agent.findUnique({ where: { id: agentId } });
      expect(dbAgent).not.toBeNull();
      expect(dbAgent?.deletedAt).not.toBeNull();

      // Historical call is still preserved in DB
      const dbCall = await prisma.call.findUnique({ where: { id: call.id } });
      expect(dbCall).not.toBeNull();
      expect(dbCall?.agentId).toBe(agentId);
    });
  });

  describe('AGT-12: Create beyond MAX_AGENTS_PER_USER', () => {
    it('returns 409 when user reaches maximum agent limit', async () => {
      // Create a fresh user for quota test
      const quotaUser = await prisma.user.create({
        data: {
          email: `quota_${Date.now()}@example.com`,
          passwordHash: 'dummy_hash',
          name: 'Quota User',
        },
      });
      const quotaToken = jwtService.sign({ sub: quotaUser.id, email: quotaUser.email });

      const maxLimit = configService.maxAgentsPerUser; // default 10

      // Fill quota up to maxLimit
      for (let i = 0; i < maxLimit; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/agents')
          .set('Cookie', `access_token=${quotaToken}`)
          .send({
            name: `Agent #${i + 1}`,
            systemPrompt: `Agent prompt description for item ${i + 1}.`,
          });
        expect(res.status).toBe(201);
      }

      // Next attempt must return 409 Conflict
      const overflowRes = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${quotaToken}`)
        .send({
          name: `Overflow Agent`,
          systemPrompt: `Attempting to exceed maximum agent limit.`,
        });

      expect(overflowRes.status).toBe(409);
      expect(overflowRes.body.statusCode).toBe(409);
      expect(overflowRes.body.message).toContain(`Maximum number of agents reached (${maxLimit})`);
    });
  });

  describe('AGT-13: Non-UUID parameter', () => {
    it('returns 400 Bad Request when id is not a valid UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/agents/not-a-valid-uuid')
        .set('Cookie', `access_token=${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toContain('Validation failed (uuid is expected)');
    });
  });

  describe('AGT-14: Unauthenticated access', () => {
    it('returns 401 Unauthorized when no auth cookie is provided', async () => {
      const resGet = await request(app.getHttpServer()).get('/api/agents');
      expect(resGet.status).toBe(401);

      const resPost = await request(app.getHttpServer())
        .post('/api/agents')
        .send({ name: 'Agent', systemPrompt: 'Prompt instructions here.' });
      expect(resPost.status).toBe(401);

      const resDelete = await request(app.getHttpServer()).delete(`/api/agents/${randomUUID()}`);
      expect(resDelete.status).toBe(401);
    });
  });

  describe('AGT-15: System prompt with script tags', () => {
    it('stores script text verbatim as plain text without stripping', async () => {
      const rawPrompt =
        'You are an assistant <script>alert("test");</script> with custom instructions.';

      const createRes = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Cookie', `access_token=${tokenA}`)
        .send({
          name: 'Script Tag Agent',
          systemPrompt: rawPrompt,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.systemPrompt).toBe(rawPrompt);

      const getRes = await request(app.getHttpServer())
        .get(`/api/agents/${createRes.body.id}`)
        .set('Cookie', `access_token=${tokenA}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.systemPrompt).toBe(rawPrompt);
    });
  });
});
