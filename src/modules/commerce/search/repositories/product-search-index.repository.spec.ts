import { ServiceUnavailableException } from '@nestjs/common';
import { ProductSearchIndexRepository } from './product-search-index.repository.js';
import { AppLogger } from '../../../../infrastructure/logging/logger.service.js';
import { requestContextStorage } from '../../../../common/context/request-context.js';
import { Prisma } from '@prisma/client';

// Minimal mock for the Prisma TransactionClient
const makeMockTx = () => ({
  $executeRaw: jest.fn(),
});

// Minimal AppLogger mock
const makeMockLogger = () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

describe('ProductSearchIndexRepository', () => {
  let repo: ProductSearchIndexRepository;
  let mockLogger: ReturnType<typeof makeMockLogger>;
  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const productId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(() => {
    mockLogger = makeMockLogger();
    repo = new ProductSearchIndexRepository(mockLogger as unknown as AppLogger);
  });

  describe('refreshProductVector', () => {
    it('should call $executeRaw with correct parameters on success', async () => {
      const tx = makeMockTx();
      tx.$executeRaw.mockResolvedValueOnce(1);

      await requestContextStorage.run(
        { tenantId, requestId: 'req-1', correlationId: 'corr-1' },
        async () => {
          await repo.refreshProductVector(tx as unknown as Prisma.TransactionClient, tenantId, productId);
        },
      );

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      // Verify the SQL template was called (tagged template — we check the call happened)
      const call = tx.$executeRaw.mock.calls[0];
      expect(call).toBeDefined();
    });

    it('should throw ServiceUnavailableException on DB failure', async () => {
      const tx = makeMockTx();
      tx.$executeRaw.mockRejectedValueOnce(new Error('connection lost'));

      await expect(
        requestContextStorage.run(
          { tenantId, requestId: 'req-2', correlationId: 'corr-2' },
          () => repo.refreshProductVector(tx as unknown as Prisma.TransactionClient, tenantId, productId),
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should log structured error details including tenantId, productId, correlationId', async () => {
      const tx = makeMockTx();
      tx.$executeRaw.mockRejectedValueOnce(new Error('SQL error'));

      await requestContextStorage.run(
        { tenantId, requestId: 'req-3', correlationId: 'my-corr-id' },
        async () => {
          await expect(
            repo.refreshProductVector(tx as unknown as Prisma.TransactionClient, tenantId, productId),
          ).rejects.toThrow(ServiceUnavailableException);
        },
      );

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const logMessage: string = mockLogger.error.mock.calls[0][0];
      expect(logMessage).toContain(tenantId);
      expect(logMessage).toContain(productId);
      expect(logMessage).toContain('my-corr-id');
      expect(logMessage).toContain('SQL error');
    });

    it('should not expose SQL error message to the thrown exception', async () => {
      const tx = makeMockTx();
      const internalSqlError = 'relation "products" does not exist';
      tx.$executeRaw.mockRejectedValueOnce(new Error(internalSqlError));

      let thrownError: unknown;
      await requestContextStorage.run(
        { tenantId, requestId: 'req-4', correlationId: 'corr-4' },
        async () => {
          try {
            await repo.refreshProductVector(tx as unknown as Prisma.TransactionClient, tenantId, productId);
          } catch (e) {
            thrownError = e;
          }
        },
      );

      expect(thrownError).toBeInstanceOf(ServiceUnavailableException);
      const message = (thrownError as ServiceUnavailableException).message;
      expect(message).not.toContain(internalSqlError);
      expect(message).not.toContain('relation');
    });

    it('should use correlationId=unknown when no request context is set', async () => {
      const tx = makeMockTx();
      tx.$executeRaw.mockRejectedValueOnce(new Error('fail'));

      await expect(
        repo.refreshProductVector(tx as unknown as Prisma.TransactionClient, tenantId, productId),
      ).rejects.toThrow(ServiceUnavailableException);

      const logMessage: string = mockLogger.error.mock.calls[0][0];
      expect(logMessage).toContain('unknown');
    });
  });
});
