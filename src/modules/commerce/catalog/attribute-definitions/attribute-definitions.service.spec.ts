import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { AttributeType } from '@prisma/client';
import { AttributeDefinitionsService } from './attribute-definitions.service.js';
import { TenantPrismaService } from '../../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../../infrastructure/cache/cache.service.js';
import { requestContextStorage } from '../../../../common/context/request-context.js';

// ─── Mock Helpers ──────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-abc';
const CATEGORY_ID = 'cat-001';
const DEF_ID = 'def-001';

const mockDef = () => ({
  id: DEF_ID,
  tenantId: TENANT_ID,
  categoryId: CATEGORY_ID,
  name: 'color',
  labelTranslations: { ar: 'اللون', en: 'Color' },
  type: AttributeType.select,
  options: [{ value: 'red', labelTranslations: { ar: 'أحمر', en: 'Red' } }],
  isRequired: false,
  position: 0,
  isVariantAxis: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  category: { id: CATEGORY_ID, nameTranslations: { en: 'Apparel', ar: 'ملابس' } },
});

const mockCategory = () => ({
  id: CATEGORY_ID,
  tenantId: TENANT_ID,
  nameTranslations: { en: 'Apparel', ar: 'ملابس' },
});

type TxCallback<T> = (tx: MockTx) => Promise<T>;

interface MockTx {
  attributeDefinition: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  category: {
    findFirst: jest.Mock;
  };
}

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('AttributeDefinitionsService', () => {
  let service: AttributeDefinitionsService;
  let mockCache: jest.Mocked<CacheService>;
  let mockTx: MockTx;
  let mockDb: { exec: jest.Mock };

  beforeEach(async () => {
    // Simulate the request context returning our fixed TENANT_ID
    jest.spyOn(requestContextStorage, 'getStore').mockReturnValue({
      tenantId: TENANT_ID,
      requestId: 'req-1',
    } as any);

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CacheService>;

    mockTx = {
      attributeDefinition: {
        findMany: jest.fn().mockResolvedValue([mockDef()]),
        findFirst: jest.fn().mockResolvedValue(mockDef()),
        create: jest.fn().mockResolvedValue(mockDef()),
        update: jest.fn().mockResolvedValue(mockDef()),
        delete: jest.fn().mockResolvedValue(mockDef()),
      },
      category: {
        findFirst: jest.fn().mockResolvedValue(mockCategory()),
      },
    };

    mockDb = {
      exec: jest.fn().mockImplementation(<T>(cb: TxCallback<T>) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributeDefinitionsService,
        { provide: TenantPrismaService, useValue: mockDb },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<AttributeDefinitionsService>(AttributeDefinitionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns cached result on cache hit without querying the database', async () => {
      const cached = [mockDef()];
      mockCache.get.mockResolvedValueOnce(cached);

      const result = await service.findAll();

      expect(result).toEqual(cached);
      expect(mockDb.exec).not.toHaveBeenCalled();
    });

    it('queries the database and caches the result on cache miss', async () => {
      const result = await service.findAll();

      expect(mockTx.attributeDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }),
      );
      expect(mockCache.set).toHaveBeenCalled();
      expect(result).toEqual([mockDef()]);
    });

    it('filters by categoryId when provided', async () => {
      await service.findAll(CATEGORY_ID);

      expect(mockTx.attributeDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: CATEGORY_ID }),
        }),
      );
    });
  });

  // ─── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns definition by ID', async () => {
      const result = await service.findById(DEF_ID);
      expect(result).toEqual(mockDef());
    });

    it('throws NotFoundException when ID is not found', async () => {
      mockTx.attributeDefinition.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('returns cached result on cache hit', async () => {
      mockCache.get.mockResolvedValueOnce(mockDef());
      const result = await service.findById(DEF_ID);
      expect(result).toEqual(mockDef());
      expect(mockDb.exec).not.toHaveBeenCalled();
    });
  });

  // ─── findForCategory ────────────────────────────────────────────────────────

  describe('findForCategory', () => {
    it('returns merged global + category-specific definitions', async () => {
      await service.findForCategory(CATEGORY_ID);

      // Should call both category verification and findMany with OR clause
      expect(mockTx.category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: CATEGORY_ID }) }),
      );
      expect(mockTx.attributeDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ categoryId: CATEGORY_ID }, { categoryId: null }],
          }),
        }),
      );
    });

    it('throws NotFoundException when the category does not belong to tenant', async () => {
      // category verification call returns null
      mockTx.category.findFirst.mockResolvedValueOnce(null);
      await expect(service.findForCategory('bad-cat')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto = {
      categoryId: CATEGORY_ID,
      name: 'size',
      labelTranslations: { ar: 'الحجم', en: 'Size' },
      type: AttributeType.select,
      options: [{ value: 'M', labelTranslations: { ar: 'متوسط', en: 'Medium' } }],
    };

    it('creates and returns the definition', async () => {
      // No duplicate
      mockTx.attributeDefinition.findFirst.mockResolvedValueOnce(null);

      const result = await service.create(validDto, TENANT_ID);
      expect(mockTx.attributeDefinition.create).toHaveBeenCalled();
      expect(result).toEqual(mockDef());
    });

    it('throws ConflictException on duplicate name in same scope', async () => {
      // category check resolves OK, then duplicate check finds existing
      mockTx.category.findFirst.mockResolvedValueOnce(mockCategory());
      mockTx.attributeDefinition.findFirst.mockResolvedValueOnce(mockDef());

      await expect(service.create(validDto, TENANT_ID)).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when select type has no options', async () => {
      mockTx.category.findFirst.mockResolvedValueOnce(mockCategory());
      await expect(
        service.create({ ...validDto, options: [] }, TENANT_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when text type receives options', async () => {
      mockTx.category.findFirst.mockResolvedValueOnce(mockCategory());
      await expect(
        service.create(
          {
            ...validDto,
            type: AttributeType.text,
            options: [{ value: 'x', labelTranslations: { en: 'X' } }],
          },
          TENANT_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when categoryId does not belong to tenant', async () => {
      mockTx.category.findFirst.mockResolvedValueOnce(null); // category not found
      await expect(service.create(validDto, TENANT_ID)).rejects.toThrow(NotFoundException);
    });

    it('invalidates cache after creation', async () => {
      mockTx.attributeDefinition.findFirst.mockResolvedValueOnce(null);
      await service.create(validDto, TENANT_ID);
      expect(mockCache.invalidatePattern).toHaveBeenCalledWith(
        expect.stringContaining(TENANT_ID),
      );
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a definition and invalidates cache', async () => {
      const result = await service.update(DEF_ID, { position: 5 }, TENANT_ID);
      expect(mockTx.attributeDefinition.update).toHaveBeenCalled();
      expect(mockCache.invalidatePattern).toHaveBeenCalled();
      expect(result).toEqual(mockDef());
    });

    it('throws NotFoundException when definition does not exist', async () => {
      mockTx.attributeDefinition.findFirst.mockResolvedValueOnce(null);
      await expect(service.update('bad-id', { position: 1 }, TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when renaming to an existing name', async () => {
      // First findFirst = existing definition (named 'color')
      // Second findFirst = duplicate found for new name 'material'
      mockTx.attributeDefinition.findFirst
        .mockResolvedValueOnce(mockDef())                     // the record to update (name: 'color')
        .mockResolvedValueOnce({ ...mockDef(), name: 'material' }); // collision record

      await expect(
        service.update(DEF_ID, { name: 'material' }, TENANT_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes definition and returns success payload', async () => {
      const result = await service.remove(DEF_ID, TENANT_ID);
      expect(mockTx.attributeDefinition.delete).toHaveBeenCalledWith({ where: { id: DEF_ID } });
      expect(result).toEqual({ success: true, deletedId: DEF_ID });
    });

    it('throws NotFoundException when definition does not exist', async () => {
      mockTx.attributeDefinition.findFirst.mockResolvedValueOnce(null);
      await expect(service.remove('bad-id', TENANT_ID)).rejects.toThrow(NotFoundException);
    });

    it('invalidates cache after deletion', async () => {
      await service.remove(DEF_ID, TENANT_ID);
      expect(mockCache.invalidatePattern).toHaveBeenCalledWith(
        expect.stringContaining(TENANT_ID),
      );
    });
  });
});
