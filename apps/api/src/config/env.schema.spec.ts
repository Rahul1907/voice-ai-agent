import { validateEnv } from './env.schema';

describe('CFG-01: Environment configuration validation', () => {
  const validMockEnv = {
    NODE_ENV: 'test',
    API_PORT: '4000',
    WEB_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://voice:voice@localhost:5432/voice_agent',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: '12345678901234567890123456789012',
    JWT_EXPIRES_IN: '1d',
    INTERNAL_API_KEY: '1234567890123456',
    INTERNAL_API_URL: 'http://localhost:4000',
    LIVEKIT_URL: 'ws://localhost:7880',
    LIVEKIT_API_KEY: 'devkey',
    LIVEKIT_API_SECRET: 'a'.repeat(32),
    LIVEKIT_AGENT_NAME: 'voice-agent',
    PROVIDER_MODE: 'mock',
  };

  it('validates and parses a valid mock environment', () => {
    const config = validateEnv(validMockEnv);
    expect(config.DATABASE_URL).toBe('postgresql://voice:voice@localhost:5432/voice_agent');
    expect(config.API_PORT).toBe(4000);
    expect(config.PROVIDER_MODE).toBe('mock');
  });

  it('throws an error explicitly listing missing required variables', () => {
    const invalidEnv = { ...validMockEnv, DATABASE_URL: undefined };
    expect(() => validateEnv(invalidEnv)).toThrow(/DATABASE_URL/);
  });

  it('throws when JWT_SECRET is shorter than 32 characters', () => {
    const invalidEnv = { ...validMockEnv, JWT_SECRET: 'too-short' };
    expect(() => validateEnv(invalidEnv)).toThrow(/JWT_SECRET must be at least 32 characters/);
  });

  it('requires GROQ_API_KEY and NVIDIA_API_KEY when PROVIDER_MODE is "real"', () => {
    const realModeEnv = {
      ...validMockEnv,
      PROVIDER_MODE: 'real',
      GROQ_API_KEY: '',
      NVIDIA_API_KEY: '',
    };
    expect(() => validateEnv(realModeEnv)).toThrow(/GROQ_API_KEY/);
    expect(() => validateEnv(realModeEnv)).toThrow(/NVIDIA_API_KEY/);
  });
});
