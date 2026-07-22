import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

@Injectable()
export class AccountingService {
  constructor(private readonly db: TenantPrismaService) {}

  async findAllEntries(query?: PaginationQueryDto) {
    const take = query?.take || 20;
    const skip = query?.skip || 0;
    return this.db.exec(async (tx) => {
      const [items, total] = await Promise.all([
        tx.journalEntry.findMany({
          include: {
            lines: true,
          },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        tx.journalEntry.count(),
      ]);
      return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
    });
  }

  async recordEntry(data: {
    entryNumber: string;
    description: string;
    referenceId?: string;
    lines: Array<{ accountName: string; debit: number; credit: number }>;
  }) {
    const ctx = requestContextStorage.getStore();
    const tenantId = ctx?.tenantId || '';

    return this.db.exec(async (tx) => {
      return tx.journalEntry.create({
        data: {
          tenantId,
          entryNumber: data.entryNumber,
          description: data.description,
          referenceId: data.referenceId,
          lines: {
            create: data.lines.map((l) => ({
              accountName: l.accountName,
              debit: l.debit,
              credit: l.credit,
            })),
          },
        },
        include: { lines: true },
      });
    });
  }
}
