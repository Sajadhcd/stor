import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RefreshTokenService } from './refresh-token.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { ConfigService } from '../../../infrastructure/config/config.service.js';
import { AppLogger } from '../../../infrastructure/logging/logger.service.js';
import { UsersService } from '../users/users.service.js';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let jwtService: jest.Mocked<JwtService>;
  let cacheService: jest.Mocked<CacheService>;
  let usersService: jest.Mocked<UsersService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-123',
    email: 'user@nexio.com',
    roleId: 'role-admin',
    tenantId: 'tenant-456',
    name: 'Test User',
  };

  beforeEach(async () => {
    const mockJwt = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
    };

    const mockConfig = {
      jwtRefreshSecret: 'test-refresh-secret',
    };

    const mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const mockUsers = {
      findById: jest.fn(),
      findTenantById: jest.fn(),
      findAllUserIdsByTenantId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: JwtService, useValue: mockJwt },
        { provide: CacheService, useValue: mockCache },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AppLogger, useValue: mockLogger },
        { provide: UsersService, useValue: mockUsers },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    jwtService = module.get(JwtService);
    cacheService = module.get(CacheService);
    usersService = module.get(UsersService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRefreshToken and store', () => {
    it('should create refresh token and store in Redis indexed set', async () => {
      jwtService.signAsync.mockResolvedValue('jwt.refresh.token' as any);
      cacheService.set.mockResolvedValue(undefined);
      cacheService.sadd.mockResolvedValue(1);

      const result = await service.createRefreshToken(mockUser);

      expect(result.refreshToken).toBe('jwt.refresh.token');
      expect(result.jti).toBeDefined();
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          tenantId: mockUser.tenantId,
          role: mockUser.roleId,
          type: 'refresh',
          jti: result.jti,
        }),
        expect.objectContaining({ expiresIn: '7d' }),
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        `refresh:${mockUser.tenantId}:${mockUser.id}:${result.jti}`,
        expect.objectContaining({ jti: result.jti, userId: mockUser.id, tenantId: mockUser.tenantId }),
        604800,
      );
      expect(cacheService.sadd).toHaveBeenCalledWith(`user-refresh:${mockUser.tenantId}:${mockUser.id}`, result.jti);
    });

    it('should throw UnauthorizedException if Redis storage fails', async () => {
      cacheService.set.mockRejectedValue(new Error('Redis down'));

      await expect(service.store('t1', 'u1', 'jti1')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validate', () => {
    it('should return true if token key exists in Redis', async () => {
      cacheService.get.mockResolvedValue({ jti: 'jti-1' });
      expect(await service.validate('t-1', 'u-1', 'jti-1')).toBe(true);
    });

    it('should return false if token key does not exist or missing args', async () => {
      cacheService.get.mockResolvedValue(null);
      expect(await service.validate('t-1', 'u-1', 'jti-1')).toBe(false);
      expect(await service.validate('', 'u-1', 'jti-1')).toBe(false);
    });

    it('should return false on Redis error', async () => {
      cacheService.get.mockRejectedValue(new Error('Redis down'));
      expect(await service.validate('t-1', 'u-1', 'jti-1')).toBe(false);
    });
  });

  describe('revoke', () => {
    it('should delete primary key and remove from secondary set', async () => {
      cacheService.del.mockResolvedValue(undefined);
      cacheService.srem.mockResolvedValue(1);

      await service.revoke('t-1', 'u-1', 'jti-1');

      expect(cacheService.del).toHaveBeenCalledWith('refresh:t-1:u-1:jti-1');
      expect(cacheService.srem).toHaveBeenCalledWith('user-refresh:t-1:u-1', 'jti-1');
    });
  });

  describe('rotateRefreshToken', () => {
    const validClaims = {
      sub: mockUser.id,
      tenantId: mockUser.tenantId,
      role: mockUser.roleId,
      type: 'refresh',
      jti: 'old-jti-123',
    };

    it('should rotate token and return user plus new refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue(validClaims as any);
      cacheService.get.mockResolvedValue({ jti: validClaims.jti });
      usersService.findById.mockResolvedValue({ id: mockUser.id, email: mockUser.email, roleId: mockUser.roleId, tenantId: mockUser.tenantId, name: mockUser.name, status: 'ACTIVE' } as any);
      usersService.findTenantById.mockResolvedValue({ id: mockUser.tenantId, status: 'ACTIVE' } as any);
      jwtService.signAsync.mockResolvedValue('new.refresh.token' as any);

      const res = await service.rotateRefreshToken('valid.old.token');

      expect(res.refreshToken).toBe('new.refresh.token');
      expect(res.jti).toBeDefined();
      expect(res.user.id).toBe(mockUser.id);
      expect(cacheService.del).toHaveBeenCalledWith(`refresh:${mockUser.tenantId}:${mockUser.id}:${validClaims.jti}`);
      expect(cacheService.srem).toHaveBeenCalledWith(`user-refresh:${mockUser.tenantId}:${mockUser.id}`, validClaims.jti);
    });

    it('should reject replay attack (already rotated / missing JTI in Redis) and revoke all user tokens', async () => {
      jwtService.verifyAsync.mockResolvedValue(validClaims as any);
      cacheService.get.mockResolvedValue(null); // Key missing in Redis -> replay attack attempt!
      cacheService.smembers.mockResolvedValue(['other-jti']);

      await expect(service.rotateRefreshToken('replayed.token')).rejects.toThrow('Revoked refresh token (possible replay attack detected)');
      expect(cacheService.smembers).toHaveBeenCalledWith(`user-refresh:${mockUser.tenantId}:${mockUser.id}`);
      expect(cacheService.del).toHaveBeenCalledWith(`refresh:${mockUser.tenantId}:${mockUser.id}:other-jti`);
    });

    it('should reject expired refresh token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
      await expect(service.rotateRefreshToken('expired.token')).rejects.toThrow('Expired or invalid refresh token');
    });

    it('should reject malformed token payload', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: mockUser.id, type: 'access' } as any);
      await expect(service.rotateRefreshToken('malformed.token')).rejects.toThrow('Malformed JWT or invalid claims in refresh token');
    });

    it('should reject if user account is suspended or inactive', async () => {
      jwtService.verifyAsync.mockResolvedValue(validClaims as any);
      cacheService.get.mockResolvedValue({ jti: validClaims.jti });
      usersService.findById.mockResolvedValue({ status: 'SUSPENDED' } as any);
      cacheService.smembers.mockResolvedValue(['old-jti-123']);

      await expect(service.rotateRefreshToken('valid.old.token')).rejects.toThrow('Account revoked or inactive');
    });

    it('should reject if tenant is suspended or inactive', async () => {
      jwtService.verifyAsync.mockResolvedValue(validClaims as any);
      cacheService.get.mockResolvedValue({ jti: validClaims.jti });
      usersService.findById.mockResolvedValue({ ...mockUser, status: 'ACTIVE' } as any);
      usersService.findTenantById.mockResolvedValue({ status: 'SUSPENDED' } as any);

      await expect(service.rotateRefreshToken('valid.old.token')).rejects.toThrow('Tenant account revoked or inactive');
    });

    it('should support multiple devices and concurrent refresh safely via unique JTIs', async () => {
      jwtService.signAsync
        .mockResolvedValueOnce('token.device1' as any)
        .mockResolvedValueOnce('token.device2' as any);

      const t1 = await service.createRefreshToken(mockUser);
      const t2 = await service.createRefreshToken(mockUser);

      expect(t1.jti).not.toBe(t2.jti);
      expect(t1.refreshToken).toBe('token.device1');
      expect(t2.refreshToken).toBe('token.device2');
    });
  });

  describe('revokeAllUserTokens and revokeAllTenantTokens', () => {
    it('should revoke all user refresh tokens using indexed set without SCAN', async () => {
      cacheService.smembers.mockResolvedValue(['jti-1', 'jti-2']);

      await service.revokeAllUserTokens('t-1', 'u-1');

      expect(cacheService.smembers).toHaveBeenCalledWith('user-refresh:t-1:u-1');
      expect(cacheService.del).toHaveBeenCalledWith('refresh:t-1:u-1:jti-1');
      expect(cacheService.del).toHaveBeenCalledWith('refresh:t-1:u-1:jti-2');
      expect(cacheService.del).toHaveBeenCalledWith('user-refresh:t-1:u-1');
    });

    it('should revoke all tokens across every user in a tenant on tenant suspension', async () => {
      usersService.findAllUserIdsByTenantId.mockResolvedValue(['user-1', 'user-2']);
      cacheService.smembers
        .mockResolvedValueOnce(['jti-1'])
        .mockResolvedValueOnce(['jti-2']);

      await service.revokeAllTenantTokens('tenant-1');

      expect(usersService.findAllUserIdsByTenantId).toHaveBeenCalledWith('tenant-1');
      expect(cacheService.smembers).toHaveBeenCalledWith('user-refresh:tenant-1:user-1');
      expect(cacheService.smembers).toHaveBeenCalledWith('user-refresh:tenant-1:user-2');
      expect(cacheService.del).toHaveBeenCalledWith('refresh:tenant-1:user-1:jti-1');
      expect(cacheService.del).toHaveBeenCalledWith('refresh:tenant-1:user-2:jti-2');
    });
  });
});
