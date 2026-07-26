import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service.js';
import { ConfigService } from '../config/config.service.js';
import { AppLogger } from '../logging/logger.service.js';

describe('CacheService', () => {
  let service: CacheService;
  let mockRedis: any;
  let mockLogger: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      scanStream: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
    };

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockConfigService = {
      redisUrl: 'redis://localhost:6379',
      redisNamespace: 'test:cache:',
      redisDefaultTtl: 300,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    service.setClient(mockRedis as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return parsed value when key exists in Redis and increment hits', async () => {
      const data = { id: 'usr-1', name: 'Test User' };
      mockRedis.get.mockResolvedValue(JSON.stringify(data));

      const result = await service.get('user:usr-1');

      expect(mockRedis.get).toHaveBeenCalledWith('test:cache:user:usr-1');
      expect(result).toEqual(data);
      expect(service.getMetrics().hits).toBe(1);
      expect(service.getMetrics().misses).toBe(0);
    });

    it('should return null when key does not exist and increment misses', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('user:unknown');

      expect(result).toBeNull();
      expect(service.getMetrics().hits).toBe(0);
      expect(service.getMetrics().misses).toBe(1);
    });

    it('should return null and log error if Redis throws', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection error'));

      const result = await service.get('user:err');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(service.getMetrics().errors).toBe(1);
    });
  });

  describe('set', () => {
    it('should serialize value and set in Redis with default TTL when not specified', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const data = { foo: 'bar' };

      await service.set('mykey', data);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:cache:mykey',
        JSON.stringify(data),
        'EX',
        300,
      );
      expect(service.getMetrics().sets).toBe(1);
    });

    it('should serialize value and set with explicit TTL when provided', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const data = { status: 'active' };

      await service.set('mykey', data, 60);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:cache:mykey',
        JSON.stringify(data),
        'EX',
        60,
      );
      expect(service.getMetrics().sets).toBe(1);
    });
  });

  describe('del', () => {
    it('should delete formatted key from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.del('mykey');

      expect(mockRedis.del).toHaveBeenCalledWith('test:cache:mykey');
      expect(service.getMetrics().dels).toBe(1);
    });
  });

  describe('sadd', () => {
    it('should add members to set and return count', async () => {
      mockRedis.sadd.mockResolvedValue(2);
      const res = await service.sadd('myset', 'a', 'b');
      expect(mockRedis.sadd).toHaveBeenCalledWith('test:cache:myset', 'a', 'b');
      expect(res).toBe(2);
      expect(service.getMetrics().sets).toBe(1);
    });

    it('should return 0 if no members passed', async () => {
      expect(await service.sadd('myset')).toBe(0);
    });
  });

  describe('srem', () => {
    it('should remove members from set and return count', async () => {
      mockRedis.srem.mockResolvedValue(1);
      const res = await service.srem('myset', 'a');
      expect(mockRedis.srem).toHaveBeenCalledWith('test:cache:myset', 'a');
      expect(res).toBe(1);
      expect(service.getMetrics().dels).toBe(1);
    });

    it('should return 0 if no members passed', async () => {
      expect(await service.srem('myset')).toBe(0);
    });
  });

  describe('smembers', () => {
    it('should fetch members from set', async () => {
      mockRedis.smembers.mockResolvedValue(['a', 'b']);
      const res = await service.smembers('myset');
      expect(mockRedis.smembers).toHaveBeenCalledWith('test:cache:myset');
      expect(res).toEqual(['a', 'b']);
      expect(service.getMetrics().hits).toBe(1);
    });
  });

  describe('invalidatePattern', () => {
    it('should scan using stream and delete all matching keys in batches', async () => {
      mockRedis.scanStream.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield ['test:cache:tenant:host:t1', 'test:cache:tenant:host:t2'];
          yield ['test:cache:tenant:host:t3'];
        },
      });
      mockRedis.del.mockResolvedValue(2);

      await service.invalidatePattern('tenant:host:');

      expect(mockRedis.scanStream).toHaveBeenCalledWith({
        match: 'test:cache:*tenant:host:*',
        count: 100,
      });
      expect(mockRedis.del).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenNthCalledWith(
        1,
        'test:cache:tenant:host:t1',
        'test:cache:tenant:host:t2',
      );
      expect(mockRedis.del).toHaveBeenNthCalledWith(2, 'test:cache:tenant:host:t3');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value and not execute factory if item exists', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ cached: true }));
      const factory = jest.fn().mockResolvedValue({ cached: false });

      const result = await service.getOrSet('test-key', factory, 60);

      expect(result).toEqual({ cached: true });
      expect(factory).not.toHaveBeenCalled();
    });

    it('should execute factory and cache fresh value when item is not in cache', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      const factory = jest.fn().mockResolvedValue({ fresh: 'data' });

      const result = await service.getOrSet('test-key', factory, 60);

      expect(result).toEqual({ fresh: 'data' });
      expect(factory).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:cache:test-key',
        JSON.stringify({ fresh: 'data' }),
        'EX',
        60,
      );
    });
  });

  describe('sadd with TTL and invalidateKeys', () => {
    it('should sadd members and set TTL to 86400', async () => {
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire = jest.fn().mockResolvedValue(1);

      await service.sadd('tracking-key', 'k1', 'k2');

      expect(mockRedis.sadd).toHaveBeenCalledWith('test:cache:tracking-key', 'k1', 'k2');
      expect(mockRedis.expire).toHaveBeenCalledWith('test:cache:tracking-key', 86400);
    });

    it('should retrieve keys from set and delete them plus the set itself in invalidateKeys', async () => {
      mockRedis.smembers.mockResolvedValue(['k1', 'k2']);
      mockRedis.del.mockResolvedValue(1);

      await service.invalidateKeys('tracking-key');

      expect(mockRedis.smembers).toHaveBeenCalledWith('test:cache:tracking-key');
      expect(mockRedis.del).toHaveBeenCalledWith('test:cache:k1');
      expect(mockRedis.del).toHaveBeenCalledWith('test:cache:k2');
      expect(mockRedis.del).toHaveBeenCalledWith('test:cache:tracking-key');
    });
  });

  describe('ping', () => {
    it('should return true if Redis responds with PONG', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      expect(await service.ping()).toBe(true);
    });

    it('should return false if Redis throws an error or connection fails', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Down'));
      expect(await service.ping()).toBe(false);
    });
  });
});
