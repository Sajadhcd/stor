import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { ConfigService } from '../../../infrastructure/config/config.service.js';
import { AppLogger } from '../../../infrastructure/logging/logger.service.js';
import { UsersService } from '../users/users.service.js';
import * as crypto from 'crypto';

export interface RefreshTokenPayload {
  sub: string;
  tenantId: string;
  role: string;
  type: string;
  jti: string;
  email?: string;
  name?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
    @Inject(forwardRef(() => UsersService)) private readonly usersService: UsersService,
  ) {}

  async createRefreshToken(user: { id: string; email: string; roleId: string; tenantId: string; name: string }): Promise<{ refreshToken: string; jti: string }> {
    const jti = crypto.randomUUID();
    const payload: RefreshTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.roleId,
      type: 'refresh',
      jti,
      email: user.email,
      name: user.name,
    };

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.jwtRefreshSecret,
      expiresIn: '7d',
    });

    const ttlSeconds = 7 * 24 * 60 * 60; // 604800 seconds (7d)
    await this.store(user.tenantId, user.id, jti, ttlSeconds);

    this.logger.debug(`Issued refresh token ${jti} for user ${user.id} (tenant ${user.tenantId})`, 'RefreshTokenService');
    return {
      refreshToken,
      jti,
    };
  }

  async store(tenantId: string, userId: string, jti: string, ttlSeconds: number = 604800): Promise<void> {
    const primaryKey = `refresh:${tenantId}:${userId}:${jti}`;
    const userSetKey = `user-refresh:${tenantId}:${userId}`;

    try {
      await this.cache.set(primaryKey, { jti, userId, tenantId, storedAt: new Date().toISOString() }, ttlSeconds);
      await this.cache.sadd(userSetKey, jti);
    } catch (err: any) {
      this.logger.error(`Redis failure storing refresh token ${jti}: ${err.message}`, err.stack, 'RefreshTokenService');
      throw new UnauthorizedException('Authentication storage service currently unavailable');
    }
  }

  async validate(tenantId: string, userId: string, jti: string): Promise<boolean> {
    if (!tenantId || !userId || !jti) return false;
    const primaryKey = `refresh:${tenantId}:${userId}:${jti}`;
    try {
      const data = await this.cache.get(primaryKey);
      return data !== null && data !== undefined;
    } catch (err: any) {
      this.logger.error(`Redis failure validating refresh token ${jti}: ${err.message}`, err.stack, 'RefreshTokenService');
      return false;
    }
  }

  async revoke(tenantId: string, userId: string, jti: string): Promise<void> {
    const primaryKey = `refresh:${tenantId}:${userId}:${jti}`;
    const userSetKey = `user-refresh:${tenantId}:${userId}`;

    try {
      await this.cache.del(primaryKey);
      await this.cache.srem(userSetKey, jti);
      this.logger.debug(`Revoked refresh token ${jti} for user ${userId}`, 'RefreshTokenService');
    } catch (err: any) {
      this.logger.error(`Redis failure revoking refresh token ${jti}: ${err.message}`, err.stack, 'RefreshTokenService');
    }
  }

  async rotateRefreshToken(oldToken: string): Promise<{ user: { id: string; email: string; roleId: string; tenantId: string; name: string }; refreshToken: string; jti: string }> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(oldToken, {
        secret: this.config.jwtRefreshSecret,
      });
    } catch (err: any) {
      this.logger.warn(`Token rotation failed: signature verification error (${err.message || 'Expired/Invalid'})`, 'RefreshTokenService');
      throw new UnauthorizedException('Expired or invalid refresh token');
    }

    if (payload.type !== 'refresh' || !payload.jti || !payload.sub || !payload.tenantId || !payload.role) {
      this.logger.warn(`Token rotation failed: malformed refresh token claims (sub: ${payload?.sub})`, 'RefreshTokenService');
      throw new UnauthorizedException('Malformed JWT or invalid claims in refresh token');
    }

    const isValid = await this.validate(payload.tenantId, payload.sub, payload.jti);
    if (!isValid) {
      this.logger.warn(`Token rotation rejected: refresh token jti ${payload.jti} missing/already rotated (Replay Attack rejection for user ${payload.sub})`, 'RefreshTokenService');
      // If a revoked/rotated token is used, revoke all tokens for this user as a security measure against replay attacks
      await this.revokeAllUserTokens(payload.tenantId, payload.sub);
      throw new UnauthorizedException('Revoked refresh token (possible replay attack detected)');
    }

    // Revoke old token immediately (remove primary key and remove from user set)
    await this.revoke(payload.tenantId, payload.sub, payload.jti);

    const user = await this.usersService.findById(payload.sub).catch(() => null);
    if (!user || user.status !== 'ACTIVE') {
      this.logger.warn(`Token rotation rejected: user account not found or inactive (${payload.sub})`, 'RefreshTokenService');
      await this.revokeAllUserTokens(payload.tenantId, payload.sub);
      throw new UnauthorizedException('Account revoked or inactive');
    }

    const tenant = await this.usersService.findTenantById(user.tenantId).catch(() => null);
    if (!tenant || tenant.status !== 'ACTIVE') {
      this.logger.warn(`Token rotation rejected: tenant account inactive (${user.tenantId})`, 'RefreshTokenService');
      await this.revokeAllTenantTokens(user.tenantId);
      throw new UnauthorizedException('Tenant account revoked or inactive');
    }

    const { refreshToken: newRefreshToken, jti: newJti } = await this.createRefreshToken({
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      tenantId: user.tenantId,
      name: user.name,
    });

    this.logger.log(`Rotated refresh token successfully for user ${user.id} (old jti: ${payload.jti}, new jti: ${newJti})`, 'RefreshTokenService');

    return {
      user: {
        id: user.id,
        email: user.email,
        roleId: user.roleId,
        tenantId: user.tenantId,
        name: user.name,
      },
      refreshToken: newRefreshToken,
      jti: newJti,
    };
  }

  async revokeAllUserTokens(tenantId: string, userId: string): Promise<void> {
    const userSetKey = `user-refresh:${tenantId}:${userId}`;
    try {
      const jtis = await this.cache.smembers(userSetKey);
      for (const jti of jtis) {
        await this.cache.del(`refresh:${tenantId}:${userId}:${jti}`);
      }
      await this.cache.del(userSetKey);
      this.logger.log(`Revoked all (${jtis.length}) refresh tokens for user ${userId} via indexed set`, 'RefreshTokenService');
    } catch (err: any) {
      this.logger.error(`Error revoking all tokens for user ${userId}: ${err.message}`, err.stack, 'RefreshTokenService');
    }
  }

  async revokeAllTenantTokens(tenantId: string): Promise<void> {
    try {
      const userIds = await this.usersService.findAllUserIdsByTenantId(tenantId);
      for (const userId of userIds) {
        await this.revokeAllUserTokens(tenantId, userId);
      }
      this.logger.log(`Revoked refresh tokens for every user (${userIds.length} users) in tenant ${tenantId}`, 'RefreshTokenService');
    } catch (err: any) {
      this.logger.error(`Error revoking all tenant tokens for ${tenantId}: ${err.message}`, err.stack, 'RefreshTokenService');
    }
  }
}
