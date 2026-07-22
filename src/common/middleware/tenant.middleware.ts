import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { CacheService } from '../../infrastructure/cache/cache.service.js';
import { requestContextStorage, RequestContextStore } from '../context/request-context.js';
import * as crypto from 'crypto';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    const correlationId = (req.headers['x-correlation-id'] as string) || requestId;
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-correlation-id', correlationId);

    const host = req.headers['host'] || '';
    const rawTenantHeader = req.headers['x-tenant-id'];
    const xTenantIdHeader = Array.isArray(rawTenantHeader) ? rawTenantHeader[0] : rawTenantHeader;
    
    let tenantId = '';

    if (xTenantIdHeader) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(xTenantIdHeader)) {
        res.status(HttpStatus.BAD_REQUEST).json({
          title: 'Bad Request',
          status: HttpStatus.BAD_REQUEST,
          detail: 'x-tenant-id must be a valid UUID',
          instance: req.url,
        });
        return;
      }

      const headerTenant = await this.resolveTenantById(xTenantIdHeader);
      if (!headerTenant || headerTenant.status !== 'ACTIVE') {
        res.status(HttpStatus.FORBIDDEN).json({
          title: 'Forbidden',
          status: HttpStatus.FORBIDDEN,
          detail: 'Tenant account is missing or inactive',
          instance: req.url,
        });
        return;
      }
      tenantId = headerTenant.id;
    }

    if (!tenantId && host) {
      const parsedTenant = await this.resolveTenantFromHost(host);
      if (parsedTenant) {
        tenantId = parsedTenant.id;
        if (parsedTenant.status !== 'ACTIVE') {
          res.status(HttpStatus.FORBIDDEN).json({
            type: 'https://api.nexiocommerce.com/errors/tenant-inactive',
            title: 'Forbidden',
            status: HttpStatus.FORBIDDEN,
            detail: `Tenant account status is ${parsedTenant.status}`,
            instance: req.url,
          });
          return;
        }
      }
    }

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const store: RequestContextStore = {
      tenantId,
      requestId,
      correlationId,
      clientIp,
      userAgent,
    };

    requestContextStorage.run(store, () => {
      next();
    });
  }

  private async resolveTenantFromHost(host: string): Promise<{ id: string; status: string } | null> {
    const hostname = host.split(':')[0].toLowerCase();
    const cacheKey = `tenant:host:${hostname}`;

    const cached = await this.cache.get<{ id: string; status: string }>(cacheKey);
    if (cached) {
      return cached;
    }

    let subdomain = '';
    if (hostname.endsWith('.localhost')) {
      subdomain = hostname.replace('.localhost', '');
    } else if (hostname.includes('.') && !hostname.startsWith('localhost')) {
      const parts = hostname.split('.');
      if (parts.length > 2) {
        subdomain = parts[0];
      }
    } else {
      subdomain = hostname;
    }

    let tenant = await this.prisma.tenant.findUnique({
      where: { customDomain: hostname },
      select: { id: true, status: true },
    });

    if (!tenant && subdomain) {
      tenant = await this.prisma.tenant.findUnique({
        where: { subdomain },
        select: { id: true, status: true },
      });
    }

    if (tenant) {
      const data = { id: tenant.id, status: tenant.status };
      await this.cache.set(cacheKey, data, 60);
      return data;
    }

    return null;
  }

  private async resolveTenantById(id: string): Promise<{ id: string; status: string } | null> {
    const cacheKey = `tenant:id:${id}`;
    const cached = await this.cache.get<{ id: string; status: string }>(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!tenant) return null;

    const data = { id: tenant.id, status: tenant.status };
    await this.cache.set(cacheKey, data, 60);
    return data;
  }
}
