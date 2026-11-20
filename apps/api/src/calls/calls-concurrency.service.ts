import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class CallsConcurrencyService implements OnModuleDestroy {
  private readonly logger = new Logger(CallsConcurrencyService.name);
  private redisClient: Redis | null = null;
  private readonly countKey = 'calls:active:count';

  constructor(private readonly config: AppConfigService) {}

  private getClient(): Redis {
    if (!this.redisClient) {
      this.redisClient = new Redis(this.config.redisUrl, {
        lazyConnect: true,
        connectTimeout: 5000,
        maxRetriesPerRequest: 3,
      });
      this.redisClient.on('error', (err) => {
        this.logger.error(`Redis connection error: ${err.message}`);
      });
    }
    return this.redisClient;
  }

  async acquireSlot(): Promise<boolean> {
    const client = this.getClient();
    const maxCalls = this.config.maxConcurrentCalls;

    // Atomic check-and-increment via Lua script
    const script = `
      local current = redis.call('GET', KEYS[1])
      if not current then
        current = 0
      else
        current = tonumber(current)
      end
      if current >= tonumber(ARGV[1]) then
        return -1
      else
        return redis.call('INCR', KEYS[1])
      end
    `;

    try {
      const result = await client.eval(script, 1, this.countKey, maxCalls);
      return result !== -1;
    } catch (err) {
      this.logger.error(`Failed to acquire concurrency slot: ${(err as Error).message}`);
      throw err;
    }
  }

  async releaseSlot(): Promise<void> {
    const client = this.getClient();

    // Atomic decrement ensuring counter does not drop below 0
    const script = `
      local current = redis.call('GET', KEYS[1])
      if current and tonumber(current) > 0 then
        return redis.call('DECR', KEYS[1])
      else
        redis.call('SET', KEYS[1], 0)
        return 0
      end
    `;

    try {
      await client.eval(script, 1, this.countKey);
    } catch (err) {
      this.logger.error(`Failed to release concurrency slot: ${(err as Error).message}`);
    }
  }

  async getActiveCount(): Promise<number> {
    const client = this.getClient();
    try {
      const val = await client.get(this.countKey);
      return val ? parseInt(val, 10) : 0;
    } catch (err) {
      this.logger.error(`Failed to get active calls count: ${(err as Error).message}`);
      return 0;
    }
  }

  async reset(): Promise<void> {
    const client = this.getClient();
    try {
      await client.set(this.countKey, 0);
    } catch (err) {
      this.logger.error(`Failed to reset concurrency count: ${(err as Error).message}`);
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
