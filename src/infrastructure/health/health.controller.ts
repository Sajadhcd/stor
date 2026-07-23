import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import * as express from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReadinessService } from './readiness.service.js';

@ApiTags('Health Check')
@Controller('health')
export class HealthController {
  constructor(private readonly readinessService: ReadinessService) {}

  @ApiOperation({ summary: 'Liveness check for container orchestration' })
  @Get('liveness')
  liveness(@Res() res: express.Response) {
    return res.status(HttpStatus.OK).json({ status: 'UP', timestamp: new Date().toISOString() });
  }

  @ApiOperation({
    summary: 'Readiness check verifying PostgreSQL, schema, Prisma, Redis, and migrations',
  })
  @Get('readiness')
  async readiness(@Res() res: express.Response) {
    const report = await this.readinessService.check();
    const status = report.status === 'UP' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(status).json(report);
  }
}
