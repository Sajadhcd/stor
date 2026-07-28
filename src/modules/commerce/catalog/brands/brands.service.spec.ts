import { Test, TestingModule } from '@nestjs/testing';
import { BrandsService } from './brands.service.js';
import { TenantPrismaService } from '../../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../../infrastructure/cache/cache.service.js';
import { QueuePublisherService } from '../../../../infrastructure/jobs/queue-publisher.service.js';
import { requestContextStorage } from '../../../../common/context/request-context.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('BrandsService', () => {
  let service: BrandsService;
  let db: any;
  let cache: any;
  let queue: any;

  beforeEach(async () => {
    db = {
      exec: jest.fn(),
    };
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      invalidatePattern: jest.fn(),
    };
    queue = {
      publishSearchJob: jest.fn().mockResolvedValue('job-id'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandsService,
        { provide: TenantPrismaService, useValue: db },
        { provide: CacheService, useValue: cache },
        { provide: QueuePublisherService, useValue: queue },
      ],
    }).compile();

    service = module.get<BrandsService>(BrandsService);
  });

  describe('update', () => {
    it('does not enqueue a job if name is unchanged', async () => {
      const mockTx = {
        brand: {
          findFirst: jest.fn().mockResolvedValue({ id: 'b1', name: 'OldName', slug: 'old' }),
          update: jest.fn().mockResolvedValue({ id: 'b1', name: 'OldName', slug: 'old', updatedAt: new Date() }),
        },
      };
      db.exec.mockImplementation(async (cb: any) => cb(mockTx));

      await service.update('b1', { name: 'OldName' }, 'tenant-1');
      expect(queue.publishSearchJob).not.toHaveBeenCalled();
    });

    it('does not enqueue a job if name is undefined in update payload', async () => {
      const mockTx = {
        brand: {
          findFirst: jest.fn().mockResolvedValue({ id: 'b1', name: 'OldName', slug: 'old' }),
          update: jest.fn().mockResolvedValue({ id: 'b1', name: 'OldName', slug: 'old', updatedAt: new Date() }),
        },
      };
      db.exec.mockImplementation(async (cb: any) => cb(mockTx));

      await service.update('b1', { description: 'test' }, 'tenant-1');
      expect(queue.publishSearchJob).not.toHaveBeenCalled();
    });

    it('enqueues a job if name is changed after successful commit', async () => {
      const updatedAt = new Date();
      const mockTx = {
        brand: {
          findFirst: jest.fn().mockResolvedValue({ id: 'b1', name: 'OldName', slug: 'old' }),
          update: jest.fn().mockResolvedValue({ id: 'b1', name: 'NewName', slug: 'old', updatedAt }),
        },
      };
      db.exec.mockImplementation(async (cb: any) => cb(mockTx));

      await requestContextStorage.run({ tenantId: 'tenant-1', correlationId: 'req-1', requestId: '1' }, async () => {
        await service.update('b1', { name: 'NewName' });
      });

      expect(queue.publishSearchJob).toHaveBeenCalledWith(
        'brand_rename_fts_fanout',
        {
          tenantId: 'tenant-1',
          brandId: 'b1',
          correlationId: 'req-1',
        },
        expect.objectContaining({
          jobId: expect.stringMatching(/^brand-rename-tenant-1-b1-\d+$/),
          attempts: 5,
        })
      );
    });

    it('does not enqueue a job if the transaction rolls back', async () => {
      const mockTx = {
        brand: {
          findFirst: jest.fn().mockResolvedValue({ id: 'b1', name: 'OldName', slug: 'old' }),
          update: jest.fn().mockRejectedValue(new Error('DB Error')),
        },
      };
      db.exec.mockImplementation(async (cb: any) => cb(mockTx));

      await expect(service.update('b1', { name: 'NewName' }, 'tenant-1')).rejects.toThrow('DB Error');
      expect(queue.publishSearchJob).not.toHaveBeenCalled();
    });

    it('catches queue failure explicitly and returns success (error policy)', async () => {
      const mockTx = {
        brand: {
          findFirst: jest.fn().mockResolvedValue({ id: 'b1', name: 'OldName', slug: 'old' }),
          update: jest.fn().mockResolvedValue({ id: 'b1', name: 'NewName', slug: 'old', updatedAt: new Date() }),
        },
      };
      db.exec.mockImplementation(async (cb: any) => cb(mockTx));
      queue.publishSearchJob.mockRejectedValue(new Error('Redis disconnected'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.update('b1', { name: 'NewName' }, 'tenant-1');
      
      expect(result.name).toBe('NewName'); // Return success despite queue down
      expect(consoleSpy).toHaveBeenCalled(); // Should log explicitly
      
      consoleSpy.mockRestore();
    });
  });
});
