import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ConfigService } from '../../infrastructure/config/config.service.js';
import { requestContextStorage } from '../../common/context/request-context.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.jwtSecret,
      });

      Object.assign(request, { user: payload });

      const headerTenantId = request.headers['x-tenant-id'] as string;
      if (headerTenantId && payload.tenantId && payload.tenantId !== headerTenantId) {
        throw new ForbiddenException('Access denied: Tenant context mismatch');
      }

      const store = requestContextStorage.getStore();
      if (store) {
        if (payload.tenantId && store.tenantId && payload.tenantId !== store.tenantId) {
          throw new ForbiddenException('Access denied: Tenant context mismatch');
        }
        if (payload.tenantId && !store.tenantId) {
          store.tenantId = payload.tenantId;
        }
        store.userId = payload.sub || payload.userId;
      }
    } catch (e) {
      if (e instanceof ForbiddenException) {
        throw e;
      }
      throw new UnauthorizedException(e instanceof Error ? e.message : 'Invalid authentication token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
