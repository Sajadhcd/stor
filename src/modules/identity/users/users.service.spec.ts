import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { CryptoService } from '../../../security/crypto.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { RefreshTokenService } from '../auth/refresh-token.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let db: jest.Mocked<TenantPrismaService>;
  let prisma: jest.Mocked<PrismaService>;
  let crypto: jest.Mocked<CryptoService>;

  const mockUser = {
    id: 'user-123',
    tenantId: 'tenant-123',
    email: 'test@velo.com',
    name: 'Test User',
    passwordHash: 'hashed_password',
    roleId: 'ADMIN',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTenant = {
    id: 'tenant-123',
    name: 'Velo Activewear',
    slug: 'velo',
    subdomain: 'velo',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const dbMock = {
      exec: jest.fn().mockImplementation((cb) => cb(txMock)),
    };

    const txMock = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const prismaMock = {
      user: {
        findFirst: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
    };

    const cryptoMock = {
      hashPassword: jest.fn().mockResolvedValue('hashed_password'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: TenantPrismaService, useValue: dbMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: CryptoService, useValue: cryptoMock },
        { provide: RefreshTokenService, useValue: { revokeAllUserTokens: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    db = module.get(TenantPrismaService);
    prisma = module.get(PrismaService);
    crypto = module.get(CryptoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should throw BadRequestException if tenantId is missing', async () => {
      await expect(service.findByEmail('test@velo.com')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should query user by email and tenantId', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@velo.com', 'tenant-123');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@velo.com', tenantId: 'tenant-123' },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findTenantBySubdomain & findTenantById', () => {
    it('should find tenant by subdomain', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);

      const result = await service.findTenantBySubdomain('velo');

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { subdomain: 'velo' },
      });
      expect(result).toEqual(mockTenant);
    });

    it('should find tenant by ID', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);

      const result = await service.findTenantById('tenant-123');

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
      });
      expect(result).toEqual(mockTenant);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of users scoped by RLS transaction', async () => {
      let tx: any;
      db.exec.mockImplementation(async (cb) => {
        tx = {
          user: {
            findMany: jest.fn().mockResolvedValue([mockUser]),
            count: jest.fn().mockResolvedValue(1),
          },
        };
        return cb(tx);
      });

      const result = await service.findAll({ page: 1, limit: 10, roleId: 'ADMIN', skip: 0, take: 10 });

      expect(tx.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roleId: 'ADMIN' },
          take: 10,
          skip: 0,
        }),
      );
      expect(result.data).toEqual([mockUser]);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return user when found within tenant transaction', async () => {
      db.exec.mockImplementation(async (cb) => {
        return cb({
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
          },
        } as any);
      });

      const result = await service.findById('user-123');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user does not exist in tenant context', async () => {
      db.exec.mockImplementation(async (cb) => {
        return cb({
          user: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        } as any);
      });

      await expect(service.findById('non-existent')).rejects.toThrow(
        new NotFoundException('User with ID non-existent not found'),
      );
    });
  });

  describe('createUser', () => {
    it('should throw BadRequestException if tenant context is missing', async () => {
      await requestContextStorage.run({ tenantId: '', requestId: 'req-1', correlationId: 'corr-1' }, async () => {
        await expect(
          service.createUser({ email: 'new@velo.com', password: 'secret', name: 'New Staff' }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    it('should create user with hashed password and tenantId from context', async () => {
      let tx: any;
      db.exec.mockImplementation(async (cb) => {
        tx = {
          user: {
            create: jest.fn().mockResolvedValue({ ...mockUser, email: 'new@velo.com' }),
          },
        };
        return cb(tx);
      });

      await requestContextStorage.run({ tenantId: 'tenant-123', requestId: 'req-1', correlationId: 'corr-1' }, async () => {
        const result = await service.createUser({
          email: 'new@velo.com',
          password: 'secret',
          name: 'New Staff',
          roleId: 'STAFF',
        });

        expect(crypto.hashPassword).toHaveBeenCalledWith('secret');
        expect(tx.user.create).toHaveBeenCalledWith({
          data: {
            email: 'new@velo.com',
            passwordHash: 'hashed_password',
            name: 'New Staff',
            roleId: 'STAFF',
            tenantId: 'tenant-123',
            status: 'ACTIVE',
          },
        });
        expect(result.email).toBe('new@velo.com');
      });
    });
  });

  describe('update & remove', () => {
    it('should update user if user exists', async () => {
      let tx: any;
      db.exec.mockImplementation(async (cb) => {
        tx = {
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
            update: jest.fn().mockResolvedValue({ ...mockUser, name: 'Updated Name' }),
          },
        };
        return cb(tx);
      });

      const result = await service.update('user-123', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should remove user if user exists', async () => {
      let tx: any;
      db.exec.mockImplementation(async (cb) => {
        tx = {
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
            delete: jest.fn().mockResolvedValue(mockUser),
          },
        };
        return cb(tx);
      });

      const result = await service.remove('user-123');
      expect(result).toEqual(mockUser);
    });
  });
});
