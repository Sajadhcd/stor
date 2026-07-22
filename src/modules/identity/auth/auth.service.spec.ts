import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { CryptoService } from '../../../security/crypto.service.js';
import { ConfigService } from '../../../infrastructure/config/config.service.js';
import { AppLogger } from '../../../infrastructure/logging/logger.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { RefreshTokenService } from './refresh-token.service.js';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let cryptoService: jest.Mocked<CryptoService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let loggerService: jest.Mocked<AppLogger>;
  let refreshTokenService: jest.Mocked<RefreshTokenService>;

  const mockTenant = {
    id: 'tenant-123',
    name: 'Velo Activewear',
    slug: 'velo',
    status: 'ACTIVE',
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-123',
    tenantId: 'tenant-123',
    email: 'admin@velo.com',
    name: 'Velo Admin',
    passwordHash: 'hashed_secret',
    roleId: 'ADMIN',
    status: 'ACTIVE',
    totalOrders: 0,
    totalSpent: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const usersMock = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findTenantBySubdomain: jest.fn(),
      findTenantById: jest.fn(),
    };

    const cryptoMock = {
      verifyPassword: jest.fn(),
      hashPassword: jest.fn(),
    };

    const jwtMock = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const configMock = {
      jwtSecret: 'test_jwt_secret',
      jwtRefreshSecret: 'test_refresh_secret',
    };

    const loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const refreshTokenMock = {
      createRefreshToken: jest.fn().mockResolvedValue({ refreshToken: 'refresh_token_mock', jti: 'mock_jti' }),
      rotateRefreshToken: jest.fn(),
      revoke: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersMock },
        { provide: CryptoService, useValue: cryptoMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
        { provide: AppLogger, useValue: loggerMock },
        { provide: RefreshTokenService, useValue: refreshTokenMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    cryptoService = module.get(CryptoService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    loggerService = module.get(AppLogger);
    refreshTokenService = module.get(RefreshTokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully authenticate user when tenantId matches and status is ACTIVE', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      usersService.findTenantById.mockResolvedValue(mockTenant as any);
      cryptoService.verifyPassword.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValueOnce('access_token_mock');
      refreshTokenService.createRefreshToken.mockResolvedValueOnce({ refreshToken: 'refresh_token_mock', jti: 'jti-1' });

      const result = await service.login('admin@velo.com', 'password', 'tenant-123');

      expect(usersService.findByEmail).toHaveBeenCalledWith('admin@velo.com', 'tenant-123');
      expect(cryptoService.verifyPassword).toHaveBeenCalledWith('password', 'hashed_secret');
      expect(result).toEqual({
        access_token: 'access_token_mock',
        refresh_token: 'refresh_token_mock',
        user: {
          id: 'user-123',
          email: 'admin@velo.com',
          name: 'Velo Admin',
          role: 'ADMIN',
          tenantId: 'tenant-123',
        },
      });
    });

    it('should resolve tenantId from subdomain when tenantId parameter is omitted', async () => {
      usersService.findTenantBySubdomain.mockResolvedValue(mockTenant as any);
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      usersService.findTenantById.mockResolvedValue(mockTenant as any);
      cryptoService.verifyPassword.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('token');

      await service.login('admin@velo.com', 'password', undefined, 'velo');

      expect(usersService.findTenantBySubdomain).toHaveBeenCalledWith('velo');
      expect(usersService.findByEmail).toHaveBeenCalledWith('admin@velo.com', 'tenant-123');
    });

    it('should throw ForbiddenException if login lacks mandatory tenant identifier', async () => {
      await requestContextStorage.run({ tenantId: '', requestId: 'req-1', correlationId: 'corr-1' }, async () => {
        await expect(service.login('admin@velo.com', 'password')).rejects.toThrow(
          ForbiddenException,
        );
      });
    });

    it('should throw UnauthorizedException if user account is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login('missing@velo.com', 'password', 'tenant-123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user account status is not ACTIVE', async () => {
      usersService.findByEmail.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' } as any);

      await expect(service.login('admin@velo.com', 'password', 'tenant-123')).rejects.toThrow(
        new UnauthorizedException('Account revoked or inactive'),
      );
    });

    it('should throw UnauthorizedException if tenant account status is not ACTIVE', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      usersService.findTenantById.mockResolvedValue({ ...mockTenant, status: 'SUSPENDED' } as any);

      await expect(service.login('admin@velo.com', 'password', 'tenant-123')).rejects.toThrow(
        new UnauthorizedException('Tenant account revoked or inactive'),
      );
    });

    it('should throw ForbiddenException if targetTenantId mismatches user.tenantId', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      usersService.findTenantById.mockResolvedValue(mockTenant as any);

      await expect(service.login('admin@velo.com', 'password', 'other-tenant-uuid')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      usersService.findTenantById.mockResolvedValue(mockTenant as any);
      cryptoService.verifyPassword.mockResolvedValue(false);

      await expect(service.login('admin@velo.com', 'wrongpassword', 'tenant-123')).rejects.toThrow(
        new UnauthorizedException('Wrong password'),
      );
    });
  });

  describe('refreshToken', () => {
    it('should rotate access and refresh tokens when refresh token and account status are valid', async () => {
      refreshTokenService.rotateRefreshToken.mockResolvedValue({
        user: mockUser as any,
        refreshToken: 'new_refresh_token',
        jti: 'new_jti',
      });
      jwtService.signAsync.mockResolvedValueOnce('new_access_token');

      const result = await service.refreshToken('valid_refresh_token');

      expect(refreshTokenService.rotateRefreshToken).toHaveBeenCalledWith('valid_refresh_token');
      expect(result).toEqual({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
      });
    });

    it('should throw UnauthorizedException if rotation fails', async () => {
      refreshTokenService.rotateRefreshToken.mockRejectedValue(new UnauthorizedException('Invalid refresh token'));

      await expect(service.refreshToken('expired_token')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });

    it('should throw UnauthorizedException during refresh if user account is inactive', async () => {
      refreshTokenService.rotateRefreshToken.mockRejectedValue(new UnauthorizedException('Account revoked or inactive'));

      await expect(service.refreshToken('valid_refresh_token')).rejects.toThrow(
        new UnauthorizedException('Account revoked or inactive'),
      );
    });

    it('should throw UnauthorizedException during refresh if tenant status is inactive', async () => {
      refreshTokenService.rotateRefreshToken.mockRejectedValue(new UnauthorizedException('Tenant account revoked or inactive'));

      await expect(service.refreshToken('valid_refresh_token')).rejects.toThrow(
        new UnauthorizedException('Tenant account revoked or inactive'),
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile summary', async () => {
      usersService.findById.mockResolvedValue(mockUser as any);

      const result = await service.getProfile('user-123');

      expect(result).toEqual({
        user: {
          id: 'user-123',
          email: 'admin@velo.com',
          name: 'Velo Admin',
          role: 'ADMIN',
          status: 'ACTIVE',
          tenantId: 'tenant-123',
        },
      });
    });
  });
});
