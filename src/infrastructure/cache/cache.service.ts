import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service.js';
import { AppLogger } from '../logging/logger.service.js';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis!: Redis;
  private namespace!: string;
  private defaultTtlSeconds!: number;
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private dels = 0;
  private errors = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.initRedis();
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('Redis connection gracefully closed', 'CacheService');
    }
  }

  private initRedis() {
    if (this.redis) return;
    this.namespace = this.config.redisNamespace;
    this.defaultTtlSeconds = this.config.redisDefaultTtl;

    this.redis = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        this.logger.warn(`Redis reconnecting... attempt ${times} (delay ${delay}ms)`, 'CacheService');
        return delay;
      },
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis client connected successfully', 'CacheService');
    });

    this.redis.on('error', (err) => {
      this.errors++;
      this.logger.error(`Redis client error: ${err.message}`, err.stack, 'CacheService');
    });

    this.redis.on('reconnecting', () => {
      this.logger.log('Redis client reconnecting to server...', 'CacheService');
    });
  }

  private getClient(): Redis {
    if (!this.redis) {
      this.initRedis();
    }
    return this.redis;
  }

  /**
   * For unit testing injection of mock Redis instance
   */
  setClient(redis: Redis) {
    this.redis = redis;
    if (!this.namespace) {
      this.namespace = this.config?.redisNamespace || 'nexio:cache:';
    }
    if (!this.defaultTtlSeconds) {
      this.defaultTtlSeconds = this.config?.redisDefaultTtl || 300;
    }
  }

  private formatKey(key: string): string {
    if (key.startsWith(this.namespace)) {
      return key;
    }
    return `${this.namespace}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const formattedKey = this.formatKey(key);
    try {
      const client = this.getClient();
      const data = await client.get(formattedKey);
      if (!data) {
        this.misses++;
        this.logger.debug(`Cache MISS: ${formattedKey} (Hits: ${this.hits}, Misses: ${this.misses})`, 'CacheService');
        return null;
      }
      this.hits++;
      this.logger.debug(`Cache HIT: ${formattedKey} (Hits: ${this.hits}, Misses: ${this.misses})`, 'CacheService');
      return JSON.parse(data) as T;
    } catch (err: any) {
      this.errors++;
      this.logger.error(`Error fetching key ${formattedKey} from cache: ${err.message}`, err.stack, 'CacheService');
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const formattedKey = this.formatKey(key);
    const ttl = ttlSeconds && ttlSeconds > 0 ? ttlSeconds : this.defaultTtlSeconds;
    try {
      const client = this.getClient();
      const serialized = JSON.stringify(value);
      await client.set(formattedKey, serialized, 'EX', ttl);
      this.sets++;
      this.logger.debug(`Cache SET: ${formattedKey} (TTL: ${ttl}s)`, 'CacheService');
    } catch (err: any) {
      this.errors++;
      this.logger.error(`Error setting key ${formattedKey} in cache: ${err.message}`, err.stack, 'CacheService');
    }
  }

  async del(key: string): Promise<void> {
    const formattedKey = this.formatKey(key);
    try {
      const client = this.getClient();
      await client.del(formattedKey);
      this.dels++;
      this.logger.debug(`Cache DEL: ${formattedKey}`, 'CacheService');
    } catch (err: any) {
      this.errors++;
      this.logger.error(`Error deleting key ${formattedKey} from cache: ${err.message}`, err.stack, 'CacheService');
    }
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    const formattedKey = this.formatKey(key);
    try {
      const client = this.getClient();
      const result = await client.sadd(formattedKey, ...members);
      this.sets++;
      this.logger.debug(`Cache SADD: ${formattedKey} (${members.length} items)`, 'CacheService');
      return result;
    } catch (err: any) {
      this.errors++;
      this.logger.error(`Error adding to set ${formattedKey}: ${err.message}`, err.stack, 'CacheService');
      return 0;
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    const formattedKey = this.formatKey(key);
    try {
      const client = this.getClient();
      const result = await client.srem(formattedKey, ...members);
      this.dels++;
      this.logger.debug(`Cache SREM: ${formattedKey} (${members.length} items)`, 'CacheService');
      return result;
    } catch (err: any) {
      this.errors++;
      this.logger.error(`Error removing from set ${formattedKey}: ${err.message}`, err.stack, 'CacheService');
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    const formattedKey = this.formatKey(key);
    try {
      const client = this.getClient();
      const result = await client.smembers(formattedKey);
      this.hits++;
      this.logger.debug(`Cache SMEMBERS: ${formattedKey} (${result.length} items)`, 'CacheService');
      return result;
    } catch (err: any) {
      this.errors++;
      this.logger.error(`Error fetching set members ${formattedKey}: ${err.message}`, err.stack, 'CacheService');
      return [];
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const matchPattern = pattern.startsWith(this.namespace)
      ? `*${pattern}*`
      : `${this.namespace}*${pattern}*`;
    try {
      const client = this.getClient();
      let count = 0;
      const stream = client.scanStream({ match: matchPattern, count: 100 });
      for await (const keys of stream) {
        if (keys.length > 0) {
          await client.del(...keys);
          count += keys.length;
        }
      }
      this.logger.debug(`Cache INVALIDATE pattern '${pattern}': ${count} keys purged`, 'CacheService');
    } catch (err: any) {
      this.errors++;
      this.logger.error(`Error invalidating pattern ${pattern}: ${err.message}`, err.stack, 'CacheService');
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
    const fresh = await factory();
    if (fresh !== null && fresh !== undefined) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }

  async ping(): Promise<boolean> {
    try {
      const client = this.getClient();
      const result = await client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  getMetrics() {
    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      dels: this.dels,
      errors: this.errors,
      hitRate: this.hits + this.misses > 0 ? Number((this.hits / (this.hits + this.misses)).toFixed(4)) : 0,
    };
  }
}
