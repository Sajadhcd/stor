import { Test, TestingModule } from '@nestjs/testing';
import { TenantMiddleware } from './tenant.middleware.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { CacheService } from '../../infrastructure/cache/cache.service.js';
import { HttpStatus } from '@nestjs/common';
import { requestContextStorage } from '../context/request-context.js';

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(async () => {
    mockPrisma = {
      tenant: {
        findUnique: jest.fn(),
      },
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMiddleware,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    middleware = module.get<TenantMiddleware>(TenantMiddleware);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should use x-tenant-id header if provided and populate RequestContextStore', async () => {
    const req: any = {
      headers: {
        'x-tenant-id': '11111111-1111-4111-8111-111111111111',
        host: 'velo.com',
      },
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res: any = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    mockCache.get.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', status: 'ACTIVE' });
    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockCache.get).toHaveBeenCalledWith('tenant:id:11111111-1111-4111-8111-111111111111');
    expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('should resolve tenant from host via Redis cache if x-tenant-id is not provided', async () => {
    const req: any = {
      headers: {
        host: 'velo.nexiocommerce.com',
      },
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res: any = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    mockCache.get.mockResolvedValue({ id: 'tenant-redis-uuid', status: 'ACTIVE' });

    await middleware.use(req, res, next);

    expect(mockCache.get).toHaveBeenCalledWith('tenant:host:velo.nexiocommerce.com');
    expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('should resolve tenant from Prisma and cache for 60s if not in Redis cache', async () => {
    const req: any = {
      headers: {
        host: 'velo.localhost',
      },
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res: any = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    mockCache.get.mockResolvedValue(null);
    mockPrisma.tenant.findUnique.mockResolvedValueOnce(null); // customDomain lookup
    mockPrisma.tenant.findUnique.mockResolvedValueOnce({ id: 'tenant-db-uuid', status: 'ACTIVE' }); // subdomain lookup
    mockCache.set.mockResolvedValue();

    await middleware.use(req, res, next);

    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(2);
    expect(mockCache.set).toHaveBeenCalledWith(
      'tenant:host:velo.localhost',
      { id: 'tenant-db-uuid', status: 'ACTIVE' },
      60,
    );
    expect(next).toHaveBeenCalled();
  });

  it('should return 403 Forbidden if resolved tenant status is not ACTIVE', async () => {
    const req: any = {
      headers: {
        host: 'suspended.com',
      },
      socket: { remoteAddress: '127.0.0.1' },
      url: '/api/v1/products',
    };
    const res: any = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    mockCache.get.mockResolvedValue({ id: 'tenant-suspended-uuid', status: 'SUSPENDED' });

    await middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(res.json).toHaveBeenCalledWith({
      type: 'https://api.nexiocommerce.com/errors/tenant-inactive',
      title: 'Forbidden',
      status: HttpStatus.FORBIDDEN,
      detail: 'Tenant account status is SUSPENDED',
      instance: '/api/v1/products',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
