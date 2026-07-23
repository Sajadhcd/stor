import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../../infrastructure/cache/cache.service.js';
import { requestContextStorage } from '../../../../common/context/request-context.js';
import { CreateBrandDto } from './dto/create-brand.dto.js';
import { UpdateBrandDto } from './dto/update-brand.dto.js';

@Injectable()
export class BrandsService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cache: CacheService,
  ) {}

  private getTenantId(): string {
    const ctx = requestContextStorage.getStore();
    return ctx?.tenantId || 'global';
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async findAll() {
    const tenantId = this.getTenantId();
    const cacheKey = `tenant:${tenantId}:brands:all`;

    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const brands = await this.db.exec(async (tx) => {
      return tx.brand.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      });
    });

    await this.cache.set(cacheKey, brands, 300);
    return brands;
  }

  async findOne(id: string) {
    const tenantId = this.getTenantId();
    const cacheKey = `tenant:${tenantId}:brand:${id}`;

    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const brand = await this.db.exec(async (tx) => {
      return tx.brand.findFirst({
        where: { id, tenantId },
        include: { _count: { select: { products: true } } },
      });
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    await this.cache.set(cacheKey, brand, 300);
    return brand;
  }

  async create(data: CreateBrandDto, tenantIdOverride?: string) {
    const tenantId = tenantIdOverride || this.getTenantId();
    const slug = data.slug || this.slugify(data.name) || `brand-${Date.now()}`;

    const brand = await this.db.exec(async (tx) => {
      const existing = await tx.brand.findFirst({
        where: { tenantId, slug },
      });
      if (existing) {
        throw new BadRequestException(`Brand slug '${slug}' is already taken for this tenant`);
      }

      return tx.brand.create({
        data: {
          tenantId,
          name: data.name,
          slug,
          logoUrl: data.logoUrl,
          description: data.description,
        },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:brand`);
    return brand;
  }

  async update(id: string, data: UpdateBrandDto, tenantIdOverride?: string) {
    const tenantId = tenantIdOverride || this.getTenantId();

    const result = await this.db.exec(async (tx) => {
      const existing = await tx.brand.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException(`Brand with ID ${id} not found`);
      }

      if (data.slug && data.slug !== existing.slug) {
        const slugExists = await tx.brand.findFirst({
          where: { tenantId, slug: data.slug },
        });
        if (slugExists) {
          throw new BadRequestException(`Brand slug '${data.slug}' is already taken`);
        }
      }

      return tx.brand.update({
        where: { id },
        data: {
          name: data.name,
          slug: data.slug,
          logoUrl: data.logoUrl,
          description: data.description,
        },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:brand`);
    return result;
  }

  async delete(id: string, tenantIdOverride?: string) {
    const tenantId = tenantIdOverride || this.getTenantId();

    const result = await this.db.exec(async (tx) => {
      const existing = await tx.brand.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException(`Brand with ID ${id} not found`);
      }

      return tx.brand.delete({
        where: { id },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:brand`);
    return result;
  }
}
