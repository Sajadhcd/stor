import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TenantPrismaService } from '../../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../../infrastructure/cache/cache.service.js';
import { requestContextStorage } from '../../../../common/context/request-context.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

/** Shape of a category node in the flattened tree response. */
export interface CategoryNode {
  id: string;
  tenantId: string;
  parentId: string | null;
  nameTranslations: Record<string, string>;
  descriptionTranslations: Record<string, string> | null;
  slug: string;
  imageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isActive: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  productCount: number;
  children: CategoryNode[];
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cache: CacheService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

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

  /**
   * Build a nested tree from a flat list of categories.
   * All children are sorted by position ASC.
   */
  private buildTree(flat: any[]): CategoryNode[] {
    const map = new Map<string, CategoryNode>();

    for (const cat of flat) {
      map.set(cat.id, { ...cat, children: [] });
    }

    const roots: CategoryNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort children by position
    const sortChildren = (nodes: CategoryNode[]) => {
      nodes.sort((a, b) => a.position - b.position);
      for (const n of nodes) sortChildren(n.children);
    };
    sortChildren(roots);

    return roots;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * GET /categories
   * Returns a tree-structured list of all categories for the tenant.
   * Only active categories are included for storefront calls; admin can
   * override by passing includeInactive.
   */
  async findAll(includeInactive = false): Promise<CategoryNode[]> {
    const tenantId = this.getTenantId();
    const cacheKey = `tenant:${tenantId}:categories:tree:${includeInactive}`;

    const cached = await this.cache.get<CategoryNode[]>(cacheKey);
    if (cached) return cached;

    const result = await this.db.exec(async (tx) => {
      const cats = await tx.category.findMany({
        where: {
          tenantId,
          ...(includeInactive ? {} : { isActive: true }),
        },
        include: {
          _count: { select: { products: true } },
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      });

      const flat: CategoryNode[] = cats.map((c) => ({
        id: c.id,
        tenantId: c.tenantId,
        parentId: c.parentId,
        nameTranslations: c.nameTranslations as Record<string, string>,
        descriptionTranslations: c.descriptionTranslations as Record<string, string> | null,
        slug: c.slug,
        imageUrl: c.imageUrl,
        metaTitle: c.metaTitle,
        metaDescription: c.metaDescription,
        isActive: c.isActive,
        position: c.position,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        productCount: c._count.products,
        children: [],
      }));

      return this.buildTree(flat);
    });

    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  /**
   * GET /categories/:slug
   * Fetch a single category by slug — useful for storefront SEO pages.
   */
  async findBySlug(slug: string): Promise<CategoryNode> {
    const tenantId = this.getTenantId();
    const cacheKey = `tenant:${tenantId}:category:slug:${slug}`;

    const cached = await this.cache.get<CategoryNode>(cacheKey);
    if (cached) return cached;

    const result = await this.db.exec(async (tx) => {
      const cat = await tx.category.findFirst({
        where: { tenantId, slug },
        include: {
          _count: { select: { products: true } },
          children: {
            where: { isActive: true },
            orderBy: [{ position: 'asc' }],
            include: { _count: { select: { products: true } } },
          },
        },
      });

      if (!cat) {
        throw new NotFoundException(`Category with slug "${slug}" not found`);
      }

      const node: CategoryNode = {
        id: cat.id,
        tenantId: cat.tenantId,
        parentId: cat.parentId,
        nameTranslations: cat.nameTranslations as Record<string, string>,
        descriptionTranslations: cat.descriptionTranslations as Record<string, string> | null,
        slug: cat.slug,
        imageUrl: cat.imageUrl,
        metaTitle: cat.metaTitle,
        metaDescription: cat.metaDescription,
        isActive: cat.isActive,
        position: cat.position,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        productCount: cat._count.products,
        children: (cat.children as any[]).map((ch) => ({
          id: ch.id,
          tenantId: ch.tenantId,
          parentId: ch.parentId,
          nameTranslations: ch.nameTranslations as Record<string, string>,
          descriptionTranslations: ch.descriptionTranslations as Record<string, string> | null,
          slug: ch.slug,
          imageUrl: ch.imageUrl,
          metaTitle: ch.metaTitle,
          metaDescription: ch.metaDescription,
          isActive: ch.isActive,
          position: ch.position,
          createdAt: ch.createdAt,
          updatedAt: ch.updatedAt,
          productCount: ch._count.products,
          children: [],
        })),
      };

      return node;
    });

    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  /**
   * GET /categories/:id
   * Fetch a single category by UUID.
   */
  async findById(id: string): Promise<CategoryNode> {
    const tenantId = this.getTenantId();
    const cacheKey = `tenant:${tenantId}:category:${id}`;

    const cached = await this.cache.get<CategoryNode>(cacheKey);
    if (cached) return cached;

    const result = await this.db.exec(async (tx) => {
      const cat = await tx.category.findFirst({
        where: { tenantId, id },
        include: {
          _count: { select: { products: true } },
          children: {
            orderBy: [{ position: 'asc' }],
            include: { _count: { select: { products: true } } },
          },
        },
      });

      if (!cat) {
        throw new NotFoundException(`Category with ID "${id}" not found`);
      }

      return {
        id: cat.id,
        tenantId: cat.tenantId,
        parentId: cat.parentId,
        nameTranslations: cat.nameTranslations as Record<string, string>,
        descriptionTranslations: cat.descriptionTranslations as Record<string, string> | null,
        slug: cat.slug,
        imageUrl: cat.imageUrl,
        metaTitle: cat.metaTitle,
        metaDescription: cat.metaDescription,
        isActive: cat.isActive,
        position: cat.position,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        productCount: cat._count.products,
        children: (cat.children as any[]).map((ch) => ({
          id: ch.id,
          tenantId: ch.tenantId,
          parentId: ch.parentId,
          nameTranslations: ch.nameTranslations as Record<string, string>,
          descriptionTranslations: ch.descriptionTranslations as Record<string, string> | null,
          slug: ch.slug,
          imageUrl: ch.imageUrl,
          metaTitle: ch.metaTitle,
          metaDescription: ch.metaDescription,
          isActive: ch.isActive,
          position: ch.position,
          createdAt: ch.createdAt,
          updatedAt: ch.updatedAt,
          productCount: ch._count.products,
          children: [],
        })),
      } as CategoryNode;
    });

    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  /**
   * POST /categories
   * Create a new category, auto-generating slug from name if not provided.
   */
  async create(dto: CreateCategoryDto, tenantIdOverride?: string): Promise<CategoryNode> {
    const tenantId = tenantIdOverride || this.getTenantId();
    const slug = dto.slug
      ? dto.slug.toLowerCase().trim()
      : this.slugify(dto.nameTranslations?.en || dto.nameTranslations?.ar || `cat-${Date.now()}`);

    const result = await this.db.exec(async (tx) => {
      // Slug uniqueness check within tenant
      const existing = await tx.category.findFirst({ where: { tenantId, slug } });
      if (existing) {
        throw new ConflictException(`Category slug "${slug}" is already taken`);
      }

      // Validate parentId belongs to the same tenant
      if (dto.parentId) {
        const parent = await tx.category.findFirst({
          where: { id: dto.parentId, tenantId },
        });
        if (!parent) {
          throw new NotFoundException(`Parent category "${dto.parentId}" not found`);
        }
      }

      const cat = await tx.category.create({
        data: {
          tenantId,
          parentId: dto.parentId,
          nameTranslations: dto.nameTranslations,
          descriptionTranslations: dto.descriptionTranslations,
          slug,
          imageUrl: dto.imageUrl,
          metaTitle: dto.metaTitle,
          metaDescription: dto.metaDescription,
          isActive: dto.isActive ?? true,
          position: dto.position ?? 0,
        },
        include: { _count: { select: { products: true } } },
      });

      return this.toNode(cat);
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:categor`);
    return result;
  }

  /**
   * PATCH /categories/:id
   * Partial update — only provided fields are updated.
   */
  async update(id: string, dto: UpdateCategoryDto, tenantIdOverride?: string): Promise<CategoryNode> {
    const tenantId = tenantIdOverride || this.getTenantId();

    const result = await this.db.exec(async (tx) => {
      const existing = await tx.category.findFirst({ where: { id, tenantId } });
      if (!existing) {
        throw new NotFoundException(`Category "${id}" not found`);
      }

      // Slug collision check (only if slug is changing)
      if (dto.slug && dto.slug !== existing.slug) {
        const slugExists = await tx.category.findFirst({
          where: { tenantId, slug: dto.slug, id: { not: id } },
        });
        if (slugExists) {
          throw new ConflictException(`Category slug "${dto.slug}" is already taken`);
        }
      }

      // Prevent circular parent references
      if (dto.parentId) {
        if (dto.parentId === id) {
          throw new BadRequestException('A category cannot be its own parent');
        }
        const parent = await tx.category.findFirst({
          where: { id: dto.parentId, tenantId },
        });
        if (!parent) {
          throw new NotFoundException(`Parent category "${dto.parentId}" not found`);
        }
      }

      const updated = await tx.category.update({
        where: { id },
        data: {
          ...(dto.nameTranslations !== undefined && { nameTranslations: dto.nameTranslations }),
          ...(dto.descriptionTranslations !== undefined && {
            descriptionTranslations: dto.descriptionTranslations,
          }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
          ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.position !== undefined && { position: dto.position }),
          ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        },
        include: { _count: { select: { products: true } } },
      });

      return this.toNode(updated);
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:categor`);
    return result;
  }

  /**
   * DELETE /categories/:id
   * Deletes a category. Children become root-level (parentId → null).
   * Products keep their associations via CategoriesOnProducts.
   */
  async remove(id: string, tenantIdOverride?: string): Promise<{ success: boolean; deletedId: string }> {
    const tenantId = tenantIdOverride || this.getTenantId();

    await this.db.exec(async (tx) => {
      const existing = await tx.category.findFirst({ where: { id, tenantId } });
      if (!existing) {
        throw new NotFoundException(`Category "${id}" not found`);
      }

      // Detach children (move to root)
      await tx.category.updateMany({
        where: { parentId: id, tenantId },
        data: { parentId: null },
      });

      // Remove category-product associations
      await tx.categoriesOnProducts.deleteMany({ where: { categoryId: id, tenantId } });

      await tx.category.delete({ where: { id } });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:categor`);
    return { success: true, deletedId: id };
  }

  /**
   * GET /categories/:id/products
   * Returns paginated products that belong to the given category.
   * Delegates to ProductsService query pattern for consistency.
   */
  async findProducts(
    categoryId: string,
    query: { page?: number; limit?: number; isPublished?: boolean },
  ) {
    const tenantId = this.getTenantId();

    // Verify category exists and belongs to tenant
    await this.findById(categoryId);

    return this.db.exec(async (tx) => {
      const take = Math.min(query.limit || 20, 100);
      const skip = ((query.page || 1) - 1) * take;

      const where: any = {
        tenantId,
        deletedAt: null,
        categories: { some: { categoryId } },
      };

      if (query.isPublished !== undefined) {
        where.isPublished = query.isPublished;
      }

      const [items, total] = await Promise.all([
        tx.product.findMany({
          where,
          include: {
            brand: true,
            images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
            variants: { include: { stockLevels: true } },
            categories: { include: { category: true } },
          },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        tx.product.count({ where }),
      ]);

      const mappedItems = items.map((p) => ({
        ...p,
        variants: p.variants.map((v) => ({
          ...v,
          availableStock: Math.max(
            0,
            v.stockLevels.reduce(
              (sum, sl) => sum + (sl.quantityPhysical - sl.quantityReserved),
              0,
            ),
          ),
        })),
      }));

      return {
        data: mappedItems,
        meta: {
          page: query.page || 1,
          limit: take,
          total,
          totalPages: Math.ceil(total / take) || 1,
        },
      };
    });
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private toNode(cat: any): CategoryNode {
    return {
      id: cat.id,
      tenantId: cat.tenantId,
      parentId: cat.parentId,
      nameTranslations: cat.nameTranslations as Record<string, string>,
      descriptionTranslations: cat.descriptionTranslations as Record<string, string> | null,
      slug: cat.slug,
      imageUrl: cat.imageUrl,
      metaTitle: cat.metaTitle,
      metaDescription: cat.metaDescription,
      isActive: cat.isActive,
      position: cat.position,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      productCount: cat._count?.products ?? 0,
      children: [],
    };
  }
}
