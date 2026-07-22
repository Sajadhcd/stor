import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import { CryptoService } from '../../../security/crypto.service.js';
import { ConfigService } from '../../../infrastructure/config/config.service.js';
import { AppLogger } from '../../../infrastructure/logging/logger.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly crypto: CryptoService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
    private readonly refreshTokenService: RefreshTokenService,
  ) { }

  async login(email: string, pass: string, tenantId?: string, subdomain?: string) {
    this.logger.log(`Login attempt initiated`, 'AuthService');

    const store = requestContextStorage.getStore();
    const contextTenantId = store?.tenantId;

    let targetTenantId = tenantId || contextTenantId;
    if (!targetTenantId && subdomain) {
      const tenant = await this.usersService.findTenantBySubdomain(subdomain);
      if (!tenant) {
        this.logger.warn(`Login failed: invalid subdomain requested`, 'AuthService');
        throw new ForbiddenException('Access denied: Invalid tenant subdomain');
      }
      targetTenantId = tenant.id;
    }

    if (!targetTenantId) {
      this.logger.warn(`Login failed: ambiguous login request rejected (missing mandatory tenant identifier)`, 'AuthService');
      throw new ForbiddenException('Access denied: Mandatory tenant identifier required (provide tenantId, subdomain, or x-tenant-id header)');
    }

    const user = await this.usersService.findByEmail(email, targetTenantId);

    if (!user) {
      this.logger.warn(`Login failed: user account not found`, 'AuthService');
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'ACTIVE') {
      this.logger.warn(`Login failed: user account inactive (${user.id})`, 'AuthService');
      throw new UnauthorizedException('Account revoked or inactive');
    }

    const tenant = await this.usersService.findTenantById(user.tenantId);
    if (!tenant || tenant.status !== 'ACTIVE') {
      this.logger.warn(`Login failed: tenant account inactive (${user.tenantId})`, 'AuthService');
      throw new UnauthorizedException('Tenant account revoked or inactive');
    }

    if (targetTenantId && user.tenantId !== targetTenantId) {
      this.logger.warn(`Login failed: cross-tenant login attempt rejected for user ${user.id}`, 'AuthService');
      throw new ForbiddenException('Access denied: Tenant context mismatch');
    }

    if (contextTenantId && user.tenantId !== contextTenantId) {
      this.logger.warn(`Login failed: host tenant mismatch for user ${user.id}`, 'AuthService');
      throw new ForbiddenException('Access denied: Tenant context mismatch');
    }

    const isMatch = await this.crypto.verifyPassword(
      pass,
      user.passwordHash,
    );

    if (!isMatch) {
      this.logger.warn(`Login failed: authentication rejected for user ${user.id}`, 'AuthService');
      throw new UnauthorizedException('Wrong password');
    }

    this.logger.log(`User ${user.id} authenticated successfully`, 'AuthService');

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.roleId,
      tenantId: user.tenantId,
      name: user.name,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.jwtSecret,
      expiresIn: '15m',
    });

    const { refreshToken } = await this.refreshTokenService.createRefreshToken({
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      tenantId: user.tenantId,
      name: user.name,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.roleId,
        tenantId: user.tenantId,
      },
    };
  }

  async refreshToken(token: string) {
    const rotated = await this.refreshTokenService.rotateRefreshToken(token);
    const accessPayload = {
      sub: rotated.user.id,
      email: rotated.user.email,
      role: rotated.user.roleId,
      tenantId: rotated.user.tenantId,
      name: rotated.user.name,
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.config.jwtSecret,
      expiresIn: '15m',
    });
    return {
      access_token: accessToken,
      refresh_token: rotated.refreshToken,
    };
  }

  async logout(refreshToken: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.jwtRefreshSecret,
      });
    } catch {
      return { success: true };
    }

    if (payload?.tenantId && payload?.sub && payload?.jti) {
      await this.refreshTokenService.revoke(payload.tenantId, payload.sub, payload.jti);
    }
    return { success: true };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.roleId,
        status: user.status,
        tenantId: user.tenantId,
      },
    };
  }
}

