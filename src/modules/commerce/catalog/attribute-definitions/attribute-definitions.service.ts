import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AttributeType } from '@prisma/client';
import { TenantPrismaService } from '../../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../../infrastructure/cache/cache.service.js';
import { requestContextStorage } from '../../../../common/context/request-context.js';
import { CreateAttributeDefinitionDto } from './dto/create-attribute-definition.dto.js';
import { UpdateAttributeDefinitionDto } from './dto/update-attribute-definition.dto.js';
import { normalizeAttributeKey } from './attribute-key.util.js';

/** Cache TTL for attribute definition reads — 5 minutes. */
const CACHE_TTL = 300;

/** Prefix used to bulk-invalidate all attribute-definition cache entries for a tenant. */
const cachePrefix = (tenantId: string) => `tenant:${tenantId}:attr-def`;

@Injectable()
export class AttributeDefinitionsService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cache: CacheService,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private getTenantId(): string {
    const ctx = requestContextStorage.getStore();
    return ctx?.tenantId ?? 'global';
  }

  /**
   * Validate that options are provided for types that require them (select, color),
   * and that text/number/boolean types do not carry options.
   */
  private validateOptions(
    type: AttributeType,
    options?: Record<string, unknown>[] | null,
  ): void {
    if ((type === AttributeType.select || type === AttributeType.color) && (!options || options.length === 0)) {
      throw new BadRequestException(
        `Attribute type "${type}" requires at least one option in the options array`,
      );
    }
    if (
      (type === AttributeType.text ||
        type === AttributeType.number ||
        type === AttributeType.boolean) &&
      options &&
      (options as unknown[]).length > 0
    ) {
      throw new BadRequestException(
        `Attribute type "${type}" does not accept options`,
      );
    }
  }

  /**
   * Verify that the category belongs to the current tenant (if a categoryId is provided).
   * Returns the category or null for global definitions.
   */
  private async verifyCategory(tenantId: string, categoryId?: string) {
    if (!categoryId) return null;

    const category = await this.db.exec((tx) =>
      tx.category.findFirst({ where: { id: categoryId, tenantId } }),
    );

    if (!category) {
      throw new NotFoundException(
        `Category "${categoryId}" not found or does not belong to this tenant`,
      );
    }

    return category;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * GET /attribute-definitions
   * Returns all attribute definitions for the current tenant, optionally filtered
   * by categoryId. Results are sorted by position ASC, then createdAt ASC.
   */
  async findAll(categoryId?: string) {
    const tenantId = this.getTenantId();
    const cacheKey = `${cachePrefix(tenantId)}:list:${categoryId ?? 'all'}`;

    const cached = await this.cache.get<unknown[]>(cacheKey);
    if (cached) return cached;

    const result = await this.db.exec((tx) =>
      tx.attributeDefinition.findMany({
        where: {
          tenantId,
          ...(categoryId !== undefined ? { categoryId } : {}),
        },
        include: { category: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
    );

    await this.cache.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  /**
   * GET /attribute-definitions/:id
   * Fetch a single definition by UUID, scoped to the current tenant.
   */
  async findById(id: string) {
    const tenantId = this.getTenantId();
    const cacheKey = `${cachePrefix(tenantId)}:${id}`;

    const cached = await this.cache.get<unknown>(cacheKey);
    if (cached) return cached;

    const definition = await this.db.exec((tx) =>
      tx.attributeDefinition.findFirst({
        where: { id, tenantId },
        include: { category: true },
      }),
    );

    if (!definition) {
      throw new NotFoundException(`AttributeDefinition "${id}" not found`);
    }

    await this.cache.set(cacheKey, definition, CACHE_TTL);
    return definition;
  }

  /**
   * GET /categories/:categoryId/attribute-definitions
   * Returns all definitions that apply to a given category.
   * Includes:
   *   1. Definitions directly assigned to the category.
   *   2. Global definitions (categoryId = null) that apply to all categories.
   * Results are merged and sorted by position ASC.
   */
  async findForCategory(categoryId: string) {
    const tenantId = this.getTenantId();
    const cacheKey = `${cachePrefix(tenantId)}:category:${categoryId}`;

    const cached = await this.cache.get<unknown[]>(cacheKey);
    if (cached) return cached;

    // Verify the category exists and belongs to this tenant
    await this.verifyCategory(tenantId, categoryId);

    const result = await this.db.exec((tx) =>
      tx.attributeDefinition.findMany({
        where: {
          tenantId,
          OR: [{ categoryId }, { categoryId: null }],
        },
        include: { category: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
    );

    await this.cache.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  /**
   * POST /attribute-definitions
   * Create a new attribute definition.
   * Enforces:
   *   - Category belongs to tenant (if provided).
   *   - No duplicate name per (tenant, categoryId) pair.
   *   - options present/absent according to type rules.
   */
  async create(dto: CreateAttributeDefinitionDto, tenantId: string) {
    // Validate options shape for the given type
    this.validateOptions(dto.type, dto.options as Record<string, unknown>[] | undefined);

    // Verify category ownership
    await this.verifyCategory(tenantId, dto.categoryId);

    // Normalize machine key name
    const normalizedName = normalizeAttributeKey(dto.name);

    const result = await this.db.exec(async (tx) => {
      // Duplicate name check within the same (tenantId, categoryId) scope
      const existing = await tx.attributeDefinition.findFirst({
        where: {
          tenantId,
          categoryId: dto.categoryId ?? null,
          name: normalizedName,
        },
      });
      if (existing) {
        const scope = dto.categoryId ? `category "${dto.categoryId}"` : 'global scope';
        throw new ConflictException(
          `Attribute name "${dto.name}" already exists in ${scope} for this tenant`,
        );
      }

      return tx.attributeDefinition.create({
        data: {
          tenantId,
          categoryId: dto.categoryId ?? null,
          name: normalizedName,
          labelTranslations: dto.labelTranslations,
          type: dto.type,
          options: dto.options ? (dto.options as any) : null,
          isRequired: dto.isRequired ?? false,
          position: dto.position ?? 0,
          isVariantAxis: dto.isVariantAxis ?? true,
        },
        include: { category: true },
      });
    });

    await this.cache.invalidatePattern(cachePrefix(tenantId));
    return result;
  }

  /**
   * PATCH /attribute-definitions/:id
   * Partial update — only provided fields are changed.
   * Re-validates options if type or options are being changed.
   */
  async update(id: string, dto: UpdateAttributeDefinitionDto, tenantId: string) {
    // Ensure the record exists and belongs to this tenant
    const existing = await this.db.exec((tx) =>
      tx.attributeDefinition.findFirst({ where: { id, tenantId } }),
    );
    if (!existing) {
      throw new NotFoundException(`AttributeDefinition "${id}" not found`);
    }

    // Determine effective type and options for cross-field validation
    const effectiveType = dto.type ?? (existing.type as AttributeType);
    const effectiveOptions = dto.options !== undefined
      ? dto.options
      : (existing.options as Record<string, unknown>[] | null);

    this.validateOptions(effectiveType, effectiveOptions as Record<string, unknown>[] | null);

    // If name is changing, check for duplicates in same scope
    let normalizedName: string | undefined = undefined;
    if (dto.name !== undefined) {
      normalizedName = normalizeAttributeKey(dto.name);
      if (normalizedName !== existing.name) {
        const duplicate = await this.db.exec((tx) =>
          tx.attributeDefinition.findFirst({
            where: {
              tenantId,
              categoryId: existing.categoryId,
              name: normalizedName,
              id: { not: id },
            },
          }),
        );
        if (duplicate) {
          const scope = existing.categoryId
            ? `category "${existing.categoryId}"`
            : 'global scope';
          throw new ConflictException(
            `Attribute name "${dto.name}" already exists in ${scope} for this tenant`,
          );
        }
      }
    }

    const result = await this.db.exec((tx) =>
      tx.attributeDefinition.update({
        where: { id },
        data: {
          ...(normalizedName !== undefined && { name: normalizedName }),
          ...(dto.labelTranslations !== undefined && { labelTranslations: dto.labelTranslations }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.options !== undefined && { options: dto.options ? (dto.options as any) : null }),
          ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
          ...(dto.position !== undefined && { position: dto.position }),
          ...(dto.isVariantAxis !== undefined && { isVariantAxis: dto.isVariantAxis }),
        },
        include: { category: true },
      }),
    );

    await this.cache.invalidatePattern(cachePrefix(tenantId));
    return result;
  }

  /**
   * DELETE /attribute-definitions/:id
   * Hard delete — removes the definition from the database.
   * Existing variant attributes JSON blobs are not affected (additive system).
   */
  async remove(id: string, tenantId: string): Promise<{ success: boolean; deletedId: string }> {
    const existing = await this.db.exec((tx) =>
      tx.attributeDefinition.findFirst({ where: { id, tenantId } }),
    );
    if (!existing) {
      throw new NotFoundException(`AttributeDefinition "${id}" not found`);
    }

    await this.db.exec((tx) => tx.attributeDefinition.delete({ where: { id } }));

    await this.cache.invalidatePattern(cachePrefix(tenantId));
    return { success: true, deletedId: id };
  }
}
