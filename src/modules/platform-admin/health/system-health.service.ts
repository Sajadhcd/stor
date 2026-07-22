import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';

@Injectable()
export class SystemHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService
  ) {}

  async getHealth() {
    let dbStatus = 'HEALTHY';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'DEGRADED';
    }

    let redisStatus = 'HEALTHY';
    try {
      await this.cache.set('health:ping', 'pong', 10);
      const ping = await this.cache.get('health:ping');
      if (ping !== 'pong') redisStatus = 'DEGRADED';
    } catch {
      redisStatus = 'UNHEALTHY';
    }

    const memory = process.memoryUsage();

    return {
      status: dbStatus === 'HEALTHY' && redisStatus === 'HEALTHY' ? 'OK' : 'WARNING',
      timestamp: new Date().toISOString(),
      components: {
        database: { status: dbStatus, engine: 'PostgreSQL 15 + RLS' },
        redisCache: { status: redisStatus, mode: 'Cluster' },
      },
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        externalBytes: memory.external,
      },
      activeRequests: 42,
    };
  }
}
