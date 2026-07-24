import { HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { ReadinessReport, ReadinessService } from './readiness.service.js';

describe('HealthController', () => {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 only when every readiness dependency is up', async () => {
    const report: ReadinessReport = {
      status: 'UP',
      timestamp: '2026-07-23T00:00:00.000Z',
      details: {
        postgres: { status: 'UP' },
        schema: { status: 'UP' },
        prisma: { status: 'UP' },
        redis: { status: 'UP' },
        migrations: { status: 'UP' },
      },
    };
    const readiness = { check: jest.fn().mockResolvedValue(report) };
    const controller = new HealthController(readiness as unknown as ReadinessService);

    await controller.readiness(response as never);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(response.json).toHaveBeenCalledWith(report);
  });

  it('returns 503 when the database schema is broken', async () => {
    const report: ReadinessReport = {
      status: 'DOWN',
      timestamp: '2026-07-23T00:00:00.000Z',
      details: {
        postgres: { status: 'UP' },
        schema: {
          status: 'DOWN',
          missingTables: ['orders'],
          message: 'Required database schema objects are missing',
        },
        prisma: { status: 'UP' },
        redis: { status: 'UP' },
        migrations: { status: 'UP' },
      },
    };
    const readiness = { check: jest.fn().mockResolvedValue(report) };
    const controller = new HealthController(readiness as unknown as ReadinessService);

    await controller.readiness(response as never);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.json).toHaveBeenCalledWith(report);
  });
});
