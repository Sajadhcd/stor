import { Test, TestingModule } from '@nestjs/testing';
import { CatalogSearchRepository } from './catalog-search.repository.js';
import { TenantPrismaService } from '../../../../infrastructure/database/tenant-prisma.service.js';
import { InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('CatalogSearchRepository', () => {
  let repository: CatalogSearchRepository;
  let db: any;
  let tx: any;

  beforeEach(async () => {
    db = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogSearchRepository,
        {
          provide: TenantPrismaService,
          useValue: db,
        },
      ],
    }).compile();

    repository = module.get<CatalogSearchRepository>(CatalogSearchRepository);

    tx = {
      $queryRaw: jest.fn(),
    };
  });

  describe('searchRankedProductIds', () => {
    const tenantId = 'tenant-123';
    const attributeDefinitions: any[] = [];

    it('should return empty if trimmed query is empty', async () => {
      const result = await repository.searchRankedProductIds(tx, tenantId, { query: '   ' }, attributeDefinitions);
      expect(result).toEqual({ items: [], total: 0 });
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    });

    it('should query DB and return empty if DB indicates normalized query is empty', async () => {
      // Mock the empty query check to return true
      tx.$queryRaw.mockResolvedValueOnce([{ is_empty: true }]);

      const result = await repository.searchRankedProductIds(tx, tenantId, { query: '،،،' }, attributeDefinitions);

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('should return items and total for valid query', async () => {
      tx.$queryRaw
        .mockResolvedValueOnce([{ is_empty: false }]) // check
        .mockResolvedValueOnce([{ count: 2 }])        // count
        .mockResolvedValueOnce([{ id: 'prod-1', rank: 0.9 }, { id: 'prod-2', rank: 0.8 }]); // items

      const result = await repository.searchRankedProductIds(tx, tenantId, { query: 'laptop' }, attributeDefinitions);

      expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        total: 2,
        items: [
          { id: 'prod-1', score: 0.9 },
          { id: 'prod-2', score: 0.8 },
        ],
      });
    });

    it('should apply price filters correctly', async () => {
      tx.$queryRaw
        .mockResolvedValueOnce([{ is_empty: false }])
        .mockResolvedValueOnce([{ count: 1 }])
        .mockResolvedValueOnce([{ id: 'prod-1', rank: 0.9 }]);

      await repository.searchRankedProductIds(tx, tenantId, { query: 'laptop', minPrice: 100, maxPrice: 500 }, attributeDefinitions);

      // Ensure the query includes price bounds
      const countCall = tx.$queryRaw.mock.calls[1][0];
      const countQueryString = countCall.strings.join('?');
      expect(countQueryString).toContain('pv.price >=');
      expect(countQueryString).toContain('pv.price <=');
    });

    it('should throw InternalServerErrorException on DB failure', async () => {
      tx.$queryRaw.mockRejectedValueOnce(new Error('DB Error'));

      await expect(repository.searchRankedProductIds(tx, tenantId, { query: 'laptop' }, attributeDefinitions))
        .rejects.toThrow(InternalServerErrorException);
    });
  });
});
