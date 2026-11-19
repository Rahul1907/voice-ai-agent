process.env.NODE_ENV = 'test';
import 'dotenv/config';
import { Controller, Get, INestApplication, Post, Body } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IsString, MinLength } from 'class-validator';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/app-config.service';
import { setupApp } from '../src/setup-app';
import { HealthCheckError, PrismaHealthIndicator } from '@nestjs/terminus';

class TestValidationDto {
  @IsString()
  @MinLength(5, { message: 'name must be at least 5 characters' })
  name!: string;
}

@Controller('test-harness')
class TestHarnessController {
  @Post('validate')
  testValidation(@Body() _dto: TestValidationDto) {
    return { success: true };
  }

  @Get('error-500')
  testError500() {
    throw new Error('Sensitive internal error with details');
  }
}

describe('Phase 3 Foundation Integration Tests', () => {
  let app: INestApplication;
  let configService: AppConfigService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestHarnessController],
    }).compile();

    app = moduleRef.createNestApplication();
    configService = app.get(AppConfigService);
    setupApp(app, configService);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('HLT-01: Health check when DB and Redis are up', () => {
    it('returns 200 with db and redis up', async () => {
      const res = await request(app.getHttpServer()).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.info.database.status).toBe('up');
      expect(res.body.info.redis.status).toBe('up');
    });
  });

  describe('HLT-02: Health check when database is down', () => {
    it('returns 503 when database check fails and does not crash', async () => {
      const mockPrismaHealth = {
        pingCheck: jest.fn().mockImplementation((key: string) => {
          throw new HealthCheckError('Database check failed', {
            [key]: { status: 'down', message: 'connection refused' },
          });
        }),
      };

      const failingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(PrismaHealthIndicator)
        .useValue(mockPrismaHealth)
        .compile();

      const failingApp = failingModule.createNestApplication();
      setupApp(failingApp, failingApp.get(AppConfigService));
      await failingApp.init();

      const res = await request(failingApp.getHttpServer()).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body.statusCode).toBe(503);
      expect(res.body.error).toHaveProperty('database');
      expect(res.body.error.database.status).toBe('down');
      expect(res.body).toHaveProperty('requestId');

      await failingApp.close();
    });
  });

  describe('ERR-01: Standardized error response shape and requestId', () => {
    it('returns standard error structure with requestId on validation failure', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/test-harness/validate')
        .send({ name: 'ab' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('statusCode', 400);
      expect(res.body).toHaveProperty('error', 'Bad Request');
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message[0]).toContain('name must be at least 5 characters');
      expect(typeof res.body.requestId).toBe('string');
      expect(res.body.requestId.length).toBeGreaterThan(0);
      expect(res.headers['x-request-id']).toBe(res.body.requestId);
    });
  });

  describe('SEC-01: Security headers via helmet', () => {
    it('sets standard security headers on responses', async () => {
      const res = await request(app.getHttpServer()).get('/api/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-download-options']).toBe('noopen');
    });
  });

  describe('SEC-02: CORS enforcement', () => {
    it('blocks or does not allow origins not matching WEB_ORIGIN', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/health')
        .set('Origin', 'http://malicious-site.example.com')
        .set('Access-Control-Request-Method', 'GET');

      const allowedOrigin = res.headers['access-control-allow-origin'];
      expect(allowedOrigin).not.toBe('http://malicious-site.example.com');
    });

    it('allows origin matching WEB_ORIGIN with credentials', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/health')
        .set('Origin', configService.webOrigin)
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).toBe(configService.webOrigin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('SEC-06: Production error masking (no stack traces)', () => {
    it('masks stack traces and sensitive error messages in production mode', async () => {
      const prodConfigService = AppConfigService.fromCustomEnv({
        ...configService.raw,
        NODE_ENV: 'production',
      });

      const prodModule = await Test.createTestingModule({
        imports: [AppModule],
        controllers: [TestHarnessController],
      })
        .overrideProvider(AppConfigService)
        .useValue(prodConfigService)
        .compile();

      const prodApp = prodModule.createNestApplication();
      setupApp(prodApp, prodConfigService);
      await prodApp.init();

      const res = await request(prodApp.getHttpServer()).get('/api/test-harness/error-500');

      expect(res.status).toBe(500);
      expect(res.body.statusCode).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');
      expect(res.body.message).toEqual(['An unexpected internal error occurred']);
      expect(res.body.stack).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('Sensitive internal error with details');

      await prodApp.close();
    });
  });
});
