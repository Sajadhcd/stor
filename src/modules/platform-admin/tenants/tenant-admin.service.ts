import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { TenantStatus, Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { TenantQueryDto } from './dto/tenant-query.dto.js';
import { RefreshTokenService } from '../../identity/auth/refresh-token.service.js';

@Injectable()
export class TenantAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async findAll(query?: TenantQueryDto) {
    const where: Prisma.TenantWhereInput = {};
    if (query?.tenantStatus) {
      where.status = query.tenantStatus;
    }
    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { subdomain: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query?.startDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.startDate);
      if (query?.endDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(query.endDate);
    }

    const take = query?.take || 20;
    const skip = query?.skip || 0;
    const orderBy: Prisma.TenantOrderByWithRelationInput = query?.sortBy
      ? { [query.sortBy]: query.sortOrder || 'desc' }
      : { createdAt: 'desc' };

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy,
        take,
        skip,
        include: {
          _count: {
            select: {
              users: true,
              products: true,
              orders: true,
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const tenantIds = tenants.map((t) => t.id);
    const revenueByTenant = await this.prisma.order.groupBy({
      by: ['tenantId'],
      _sum: {
        grandTotal: true,
      },
      where: {
        tenantId: { in: tenantIds },
      },
    });

    const revenueMap = new Map<string, number>();
    for (const item of revenueByTenant) {
      revenueMap.set(item.tenantId, item._sum.grandTotal ? Number(item._sum.grandTotal) : 0);
    }

    const results = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      subdomain: t.subdomain,
      status: t.status,
      createdAt: t.createdAt,
      usersCount: t._count.users,
      productsCount: t._count.products,
      ordersCount: t._count.orders,
      revenue: revenueMap.get(t.id) || 0,
    }));

    return new PaginatedResponseDto(results, total, query?.page || 1, query?.limit || 20);
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, products: true, orders: true, stores: true },
        },
      },
    });

    if (!tenant) throw new NotFoundException(`Tenant with ID ${id} not found`);

    const totalRevenue = await this.prisma.order.aggregate({
      where: { tenantId: id },
      _sum: { grandTotal: true },
    });

    return {
      ...tenant,
      revenue: totalRevenue._sum.grandTotal ? Number(totalRevenue._sum.grandTotal) : 0,
    };
  }

  async create(data: { name: string; subdomain: string }) {
    return this.prisma.tenant.create({
      data: {
        name: data.name,
        subdomain: data.subdomain,
        status: TenantStatus.ACTIVE,
      },
    });
  }

  async update(id: string, data: { name?: string; status?: TenantStatus; settings?: Prisma.InputJsonValue }) {
    await this.findOne(id);
    const updated = await this.prisma.tenant.update({
      where: { id },
      data,
    });
    await this.cache.invalidatePattern(`tenant:host:`);
    await this.cache.invalidatePattern(`tenant:id:${id}`);
    if (data.status && data.status !== TenantStatus.ACTIVE) {
      await this.refreshTokenService.revokeAllTenantTokens(id);
    }
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.SUSPENDED },
    });
    await this.cache.invalidatePattern(`tenant:host:`);
    await this.cache.invalidatePattern(`tenant:id:${id}`);
    await this.refreshTokenService.revokeAllTenantTokens(id);
    return updated;
  }
}
