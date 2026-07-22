import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { StoreQueryDto } from './dto/store-query.dto.js';

@Injectable()
export class StoresService {
  constructor(private readonly db: TenantPrismaService) {}

  async findAll(query?: StoreQueryDto) {
    return this.db.exec(async (tx) => {
      const where: Prisma.StoreWhereInput = {};
      if (query?.currency) {
        where.currency = query.currency;
      }
      if (query?.search) {
        where.name = { contains: query.search, mode: 'insensitive' };
      }
      if (query?.startDate || query?.endDate) {
        where.createdAt = {};
        if (query?.startDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.startDate);
        if (query?.endDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(query.endDate);
      }

      const take = query?.take || 20;
      const skip = query?.skip || 0;
      const orderBy: Prisma.StoreOrderByWithRelationInput = query?.sortBy ? { [query.sortBy]: query.sortOrder || 'desc' } : { createdAt: 'desc' };


      const [items, total] = await Promise.all([
        tx.store.findMany({
          where,
          orderBy,
          take,
          skip,
        }),
        tx.store.count({ where }),
      ]);

      return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
    });
  }

  async findById(id: string) {
    const store = await this.db.exec(async (tx) => {
      return tx.store.findUnique({
        where: { id },
      });
    });
    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }
    return store;
  }

  async createStore(data: { name: string; currency?: string; languageDefault?: string }) {
    const ctx = requestContextStorage.getStore();
    const tenantId = ctx?.tenantId || '';

    return this.db.exec(async (tx) => {
      return tx.store.create({
        data: {
          name: data.name,
          currency: data.currency || 'SAR',
          languageDefault: data.languageDefault || 'ar',
          tenantId,
        },
      });
    });
  }

  async update(id: string, data: { name?: string; currency?: string; languageDefault?: string }) {
    await this.findById(id);
    return this.db.exec(async (tx) => {
      return tx.store.update({
        where: { id },
        data,
      });
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.db.exec(async (tx) => {
      return tx.store.delete({
        where: { id },
      });
    });
  }
}
