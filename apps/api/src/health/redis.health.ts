import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator implements OnModuleDestroy {
  private redisClient: Redis | null = null;

  constructor(private readonly configService: AppConfigService) {
    super();
  }

  private getClient(): Redis {
    if (!this.redisClient) {
      this.redisClient = new Redis(this.configService.redisUrl, {
        lazyConnect: true,
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
    }
    return this.redisClient;
  }

  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    try {
      const client = this.getClient();
      if (client.status !== 'ready') {
        await client.connect();
      }
      const pong = await client.ping();
      if (pong !== 'PONG') {
        throw new Error(`Unexpected Redis ping response: ${pong}`);
      }
      return this.getStatus(key, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Redis error';
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, { message }),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect();
      }
      this.redisClient = null;
    }
  }
}
