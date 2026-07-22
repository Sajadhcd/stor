import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { Prisma } from '@prisma/client';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { CustomerQueryDto } from './dto/customer-query.dto.js';

@Injectable()
export class CustomersService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cache: CacheService
  ) {}

  async findAll(query?: CustomerQueryDto) {
    const ctx = requestContextStorage.getStore();
    const tenantId = ctx?.tenantId || 'global';
    const cacheKey = `tenant:${tenantId}:customers:${JSON.stringify(query || {})}`;

    const cached = await this.cache.get<PaginatedResponseDto<unknown>>(cacheKey);
    if (cached) return cached;

    const result = await this.db.exec(async (tx) => {
      const where: Prisma.CustomerWhereInput = {};
      if (query?.email) {
        where.email = query.email;
      }
      if (query?.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ];
      }
      if (query?.startDate || query?.endDate) {
        where.createdAt = {};
        if (query?.startDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.startDate);
        if (query?.endDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(query.endDate);
      }

      const take = query?.take || 20;
      const skip = query?.skip || 0;
      const orderBy: Prisma.CustomerOrderByWithRelationInput = query?.sortBy ? { [query.sortBy]: query.sortOrder || 'desc' } : { createdAt: 'desc' };

      const [items, total] = await Promise.all([
        tx.customer.findMany({
          where,
          orderBy,
          take,
          skip,
        }),
        tx.customer.count({ where }),
      ]);

      return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
    });

    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  async findById(id: string) {
    const ctx = requestContextStorage.getStore();
    const tenantId = ctx?.tenantId || 'global';
    const cacheKey = `tenant:${tenantId}:customer:${id}`;

    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const customer = await this.db.exec(async (tx) => {
      return tx.customer.findUnique({
        where: { id },
      });
    });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    await this.cache.set(cacheKey, customer, 300);
    return customer;
  }

  async create(data: { name: string; email: string; phone?: string; address?: Prisma.InputJsonValue }) {
    const ctx = requestContextStorage.getStore();
    const tenantId = ctx?.tenantId || '';

    const result = await this.db.exec(async (tx) => {
      return tx.customer.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          tenantId,
        },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:customer`);
    return result;
  }

  async update(id: string, data: { name?: string; email?: string; phone?: string; address?: Prisma.InputJsonValue }) {
    const customer = await this.findById(id);
    const result = await this.db.exec(async (tx) => {
      return tx.customer.update({
        where: { id },
        data,
      });
    });

    await this.cache.invalidatePattern(`tenant:${customer.tenantId}:customer`);
    return result;
  }

  async remove(id: string) {
    const customer = await this.findById(id);
    const result = await this.db.exec(async (tx) => {
      return tx.customer.delete({
        where: { id },
      });
    });

    await this.cache.invalidatePattern(`tenant:${customer.tenantId}:customer`);
    return result;
  }
}
