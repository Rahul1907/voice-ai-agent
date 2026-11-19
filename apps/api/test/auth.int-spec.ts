process.env.NODE_ENV = 'test';
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

function getCookies(res: request.Response): string[] {
  const cookies = res.headers['set-cookie'];
  if (Array.isArray(cookies)) {
    return cookies;
  }
  if (typeof cookies === 'string') {
    return [cookies];
  }
  return [];
}

function getCookie(res: request.Response, name: string): string | undefined {
  return getCookies(res).find((c) => c.startsWith(`${name}=`));
}

interface ClearableThrottlerStorage {
  _storage?: Map<unknown, unknown>;
  storage?: Map<unknown, unknown>;
  hitExpirations?: Map<unknown, unknown>;
}

function resetThrottler(storage: unknown): void {
  const target = storage as ClearableThrottlerStorage | null | undefined;
  if (target) {
    target._storage?.clear();
    target.storage?.clear();
    target.hitExpirations?.clear();
  }
}

describe('Phase 4 Authentication Integration Tests (AUTH-01 to AUTH-17)', () => {
  let app: INestApplication;
  let configService: AppConfigService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let throttlerStorage: ThrottlerStorageService | null = null;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configService = app.get(AppConfigService);
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    try {
      throttlerStorage = app.get(ThrottlerStorage);
    } catch {
      throttlerStorage = null;
    }

    setupApp(app, configService);
    await app.init();

    // Clean up test users created from previous test runs
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'auth01@example.com',
            'auth02@example.com',
            'normuser@example.com',
            'spacedcase@example.com',
            'temp_user@example.com',
            'ratelimit@example.com',
          ],
        },
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              'auth01@example.com',
              'auth02@example.com',
              'normuser@example.com',
              'spacedcase@example.com',
              'temp_user@example.com',
              'ratelimit@example.com',
            ],
          },
        },
      });
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    resetThrottler(throttlerStorage);
  });

  afterEach(() => {
    resetThrottler(throttlerStorage);
  });

  describe('AUTH-01: Register valid user', () => {
    it('creates a user, returns 201 without passwordHash, and sets httpOnly cookie', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'auth01@example.com',
        password: 'ValidPassword123',
        name: 'Auth One User',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.email).toBe('auth01@example.com');
      expect(res.body.name).toBe('Auth One User');
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.body.password).toBeUndefined();

      const tokenCookie = getCookie(res, 'access_token');
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toContain('HttpOnly');
      expect(tokenCookie).toContain('Path=/');
      expect(tokenCookie).toMatch(/SameSite=Lax/i);
    });
  });

  describe('AUTH-02: Register duplicate email (case-insensitive)', () => {
    it('returns 409 Conflict when attempting to register with an existing email', async () => {
      // First registration
      await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'auth02@example.com',
        password: 'ValidPassword123',
        name: 'Auth Two',
      });

      // Second registration with uppercase variation
      const res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'AUTH02@EXAMPLE.COM',
        password: 'ValidPassword123',
        name: 'Duplicate Auth Two',
      });

      expect(res.status).toBe(409);
      expect(res.body.statusCode).toBe(409);
      expect(res.body.error).toBe('Conflict');
      expect(res.body.message).toContain('An account with this email address already exists');
      expect(res.body).toHaveProperty('requestId');
    });
  });

  describe('AUTH-03: Invalid email format', () => {
    it('returns 400 Bad Request with validation message when email format is invalid', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'not-a-valid-email',
        password: 'ValidPassword123',
        name: 'Invalid Email',
      });

      expect(res.status).toBe(400);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message.some((m: string) => m.toLowerCase().includes('email'))).toBe(true);
    });
  });

  describe('AUTH-04: Weak password rejection', () => {
    it('rejects password shorter than 8 characters', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'weak-short@example.com',
        password: 'Pass1',
        name: 'Short Pass',
      });

      expect(res.status).toBe(400);
      expect(res.body.message.some((m: string) => m.includes('between 8 and 72 characters'))).toBe(
        true,
      );
    });

    it('rejects password with no number', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'weak-nonum@example.com',
        password: 'OnlyLettersPassword',
        name: 'No Number',
      });

      expect(res.status).toBe(400);
      expect(
        res.body.message.some((m: string) => m.includes('at least one letter and one number')),
      ).toBe(true);
    });

    it('rejects password with no letter', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'weak-noletter@example.com',
        password: '1234567890',
        name: 'No Letter',
      });

      expect(res.status).toBe(400);
      expect(
        res.body.message.some((m: string) => m.includes('at least one letter and one number')),
      ).toBe(true);
    });

    it('rejects password longer than 72 characters (Argon2 limit)', async () => {
      const longPassword = 'A1' + 'a'.repeat(71); // 73 chars
      const res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'weak-long@example.com',
        password: longPassword,
        name: 'Too Long',
      });

      expect(res.status).toBe(400);
      expect(res.body.message.some((m: string) => m.includes('72 characters'))).toBe(true);
    });
  });

  describe('AUTH-05: Email normalization', () => {
    it('trims leading/trailing whitespace and converts email to lowercase', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: '   SpacedCase@Example.COM   ',
        password: 'ValidPassword123',
        name: 'Spaced Case User',
      });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe('spacedcase@example.com');

      // Verify directly in DB
      const userInDb = await prisma.user.findUnique({
        where: { email: 'spacedcase@example.com' },
      });
      expect(userInDb).not.toBeNull();
      expect(userInDb?.email).toBe('spacedcase@example.com');
    });
  });

  describe('AUTH-06: Database password hash verification (Argon2id)', () => {
    it('stores password as an argon2id hash and never as plaintext', async () => {
      const userInDb = await prisma.user.findUnique({
        where: { email: 'auth01@example.com' },
      });

      expect(userInDb).not.toBeNull();
      expect(userInDb?.passwordHash).toBeDefined();
      expect(userInDb?.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(userInDb?.passwordHash).not.toContain('ValidPassword123');
    });
  });

  describe('AUTH-07: Login with valid credentials', () => {
    it('returns 200, sets access_token cookie, and returns user without passwordHash', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/login').send({
        email: 'auth01@example.com',
        password: 'ValidPassword123',
      });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('auth01@example.com');
      expect(res.body.name).toBe('Auth One User');
      expect(res.body.passwordHash).toBeUndefined();

      const tokenCookie = getCookie(res, 'access_token');
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toContain('HttpOnly');
      expect(tokenCookie).toContain('Path=/');
      expect(tokenCookie).toMatch(/SameSite=Lax/i);
    });
  });

  describe('AUTH-08: Login with wrong password', () => {
    it('returns 401 with generic "Invalid email or password" error', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/login').send({
        email: 'auth01@example.com',
        password: 'WrongPassword999',
      });

      expect(res.status).toBe(401);
      expect(res.body.statusCode).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
      expect(res.body.message).toContain('Invalid email or password');
    });
  });

  describe('AUTH-09: Login with non-existent email', () => {
    it('returns 401 with identical "Invalid email or password" error to prevent enumeration', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/login').send({
        email: 'nonexistent-user-12345@example.com',
        password: 'ValidPassword123',
      });

      expect(res.status).toBe(401);
      expect(res.body.statusCode).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
      expect(res.body.message).toContain('Invalid email or password');
    });
  });

  describe('AUTH-10: GET /api/auth/me with valid auth cookie', () => {
    it('returns 200 with current user profile when valid cookie is provided', async () => {
      // Login first to get cookie
      const loginRes = await request(app.getHttpServer()).post('/api/auth/login').send({
        email: 'auth01@example.com',
        password: 'ValidPassword123',
      });

      const tokenCookie = getCookie(loginRes, 'access_token');
      expect(tokenCookie).toBeDefined();

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', tokenCookie!);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('auth01@example.com');
      expect(res.body.name).toBe('Auth One User');
      expect(res.body.passwordHash).toBeUndefined();
    });
  });

  describe('AUTH-11: GET /api/auth/me without cookie', () => {
    it('returns 401 Unauthorized when no credentials are provided', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.statusCode).toBe(401);
    });
  });

  describe('AUTH-12: Tampered JWT signature', () => {
    it('returns 401 Unauthorized when token signature is tampered', async () => {
      const validToken = jwtService.sign({ sub: 'tamper-id', email: 'tamper@example.com' });
      const tamperedToken = validToken.slice(0, -6) + 'badbad';

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', `access_token=${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.statusCode).toBe(401);
    });
  });

  describe('AUTH-13: Expired JWT', () => {
    it('returns 401 Unauthorized when JWT token has expired', async () => {
      const expiredToken = jwtService.sign(
        { sub: 'auth01-id', email: 'auth01@example.com' },
        { expiresIn: '-1s' },
      );

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', `access_token=${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.statusCode).toBe(401);
    });
  });

  describe('AUTH-14: POST /api/auth/logout', () => {
    it('returns 200 and clears the access_token cookie', async () => {
      // First login
      const loginRes = await request(app.getHttpServer()).post('/api/auth/login').send({
        email: 'auth01@example.com',
        password: 'ValidPassword123',
      });

      const tokenCookie = getCookie(loginRes, 'access_token');
      expect(tokenCookie).toBeDefined();

      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', tokenCookie!);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');

      const clearedCookie = getCookie(res, 'access_token');
      expect(clearedCookie).toBeDefined();
      // Cleared cookie either has Max-Age=0 or Expires in the past (1970)
      expect(
        clearedCookie!.includes('Max-Age=0') ||
          clearedCookie!.includes('Expires=Thu, 01 Jan 1970') ||
          clearedCookie!.includes('access_token=;'),
      ).toBe(true);
    });
  });

  describe('AUTH-15: Rate limiting on auth endpoints', () => {
    it('allows 5 login attempts within 1 minute, and blocks the 6th with 429 Too Many Requests', async () => {
      // Ensure storage is clean
      resetThrottler(throttlerStorage);

      // 5 requests within the limit
      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer()).post('/api/auth/login').send({
          email: 'auth01@example.com',
          password: 'WrongPasswordForRateLimit',
        });
        expect(res.status).toBe(401);
      }

      // 6th request should be throttled
      const throttledRes = await request(app.getHttpServer()).post('/api/auth/login').send({
        email: 'auth01@example.com',
        password: 'WrongPasswordForRateLimit',
      });

      expect(throttledRes.status).toBe(429);
      expect(throttledRes.body.statusCode).toBe(429);
      expect(throttledRes.body.message.some((m: string) => m.includes('Too Many Requests'))).toBe(
        true,
      );
    });
  });

  describe('AUTH-16: Extra unknown field rejection (forbidNonWhitelisted)', () => {
    it('returns 400 Bad Request when unknown extra fields are sent in register body', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'whitelist-test@example.com',
        password: 'ValidPassword123',
        name: 'Extra Field User',
        maliciousField: 'exploit',
      });

      expect(res.status).toBe(400);
      expect(res.body.statusCode).toBe(400);
      expect(
        res.body.message.some((m: string) => m.includes('maliciousField should not exist')),
      ).toBe(true);
    });
  });

  describe('AUTH-17: Authenticated request after user is deleted from DB', () => {
    it('returns 401 Unauthorized when token belongs to a user who was deleted', async () => {
      // 1. Register a temporary user
      const registerRes = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'temp_user@example.com',
        password: 'ValidPassword123',
        name: 'Temporary User',
      });

      expect(registerRes.status).toBe(201);
      const tokenCookie = getCookie(registerRes, 'access_token');
      expect(tokenCookie).toBeDefined();

      // 2. Verify token works
      const meResBefore = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', tokenCookie!);
      expect(meResBefore.status).toBe(200);

      // 3. Delete user directly from DB
      await prisma.user.delete({
        where: { email: 'temp_user@example.com' },
      });

      // 4. Try requesting /api/auth/me with the same token
      const meResAfter = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', tokenCookie!);

      expect(meResAfter.status).toBe(401);
      expect(meResAfter.body.statusCode).toBe(401);
      expect(meResAfter.body.message).toContain('User no longer exists or session expired');
    });
  });
});
