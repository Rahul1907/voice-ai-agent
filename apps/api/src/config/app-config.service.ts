import { Injectable } from '@nestjs/common';
import { EnvConfig, validateEnv } from './env.schema';

@Injectable()
export class AppConfigService {
  private readonly config: EnvConfig;

  constructor() {
    this.config = validateEnv(process.env);
  }

  static fromCustomEnv(customEnv: Record<string, unknown>): AppConfigService {
    const service = Object.create(AppConfigService.prototype) as AppConfigService;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).config = validateEnv(customEnv);
    return service;
  }

  get raw(): EnvConfig {
    return this.config;
  }

  get nodeEnv(): 'development' | 'production' | 'test' {
    return this.config.NODE_ENV;
  }

  get isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  get isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }

  get port(): number {
    return this.config.API_PORT;
  }

  get webOrigin(): string {
    return this.config.WEB_ORIGIN;
  }

  get databaseUrl(): string {
    if (this.isTest && this.config.DATABASE_URL_TEST) {
      return this.config.DATABASE_URL_TEST;
    }
    return this.config.DATABASE_URL;
  }

  get redisUrl(): string {
    if (this.isTest && this.config.REDIS_URL_TEST) {
      return this.config.REDIS_URL_TEST;
    }
    return this.config.REDIS_URL;
  }

  get jwtSecret(): string {
    return this.config.JWT_SECRET;
  }

  get jwtExpiresIn(): string {
    return this.config.JWT_EXPIRES_IN;
  }

  get internalApiKey(): string {
    return this.config.INTERNAL_API_KEY;
  }

  get livekitUrl(): string {
    return this.config.LIVEKIT_URL;
  }

  get livekitApiKey(): string {
    return this.config.LIVEKIT_API_KEY;
  }

  get livekitApiSecret(): string {
    return this.config.LIVEKIT_API_SECRET;
  }

  get livekitAgentName(): string {
    return this.config.LIVEKIT_AGENT_NAME;
  }

  get providerMode(): 'real' | 'mock' {
    return this.config.PROVIDER_MODE;
  }

  get ttsServerUrl(): string {
    return this.config.TTS_SERVER_URL;
  }

  get maxConcurrentCalls(): number {
    return this.config.MAX_CONCURRENT_CALLS;
  }

  get maxAgentsPerUser(): number {
    return this.config.MAX_AGENTS_PER_USER;
  }

  get maxDocsPerAgent(): number {
    return this.config.MAX_DOCS_PER_AGENT;
  }

  get maxUploadMb(): number {
    return this.config.MAX_UPLOAD_MB;
  }

  get defaultTimezone(): string {
    return this.config.DEFAULT_TIMEZONE;
  }
}
