import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import * as express from 'express';
import { PrismaService } from '../database/prisma.service.js';
import { ConfigService } from '../config/config.service.js';
import { CacheService } from '../cache/cache.service.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health Check')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  @ApiOperation({ summary: 'Liveness check for container orchestration' })
  @Get('liveness')
  liveness(@Res() res: express.Response) {
    return res.status(HttpStatus.OK).json({ status: 'UP', timestamp: new Date().toISOString() });
  }

  @ApiOperation({ summary: 'Readiness check verifying database and Redis connections' })
  @Get('readiness')
  async readiness(@Res() res: express.Response) {
    const healthReport: any = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      details: {},
    };

    let hasError = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      healthReport.details.database = { status: 'UP' };
    } catch (e) {
      hasError = true;
      healthReport.details.database = { status: 'DOWN', error: e instanceof Error ? e.message : String(e) };
    }

    try {
      const redisUp = await this.cacheService.ping();
      if (!redisUp) {
        throw new Error('Redis ping failed or connection is unavailable');
      }
      healthReport.details.redis = { status: 'UP' };
    } catch (e) {
      hasError = true;
      healthReport.details.redis = { status: 'DOWN', error: e instanceof Error ? e.message : String(e) };
    }

    if (hasError) {
      healthReport.status = 'DOWN';
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(healthReport);
    }

    return res.status(HttpStatus.OK).json(healthReport);
  }
}
