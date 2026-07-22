import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../../infrastructure/database/tenant-prisma.service.js';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

@Injectable()
export class AuditLogService {
  constructor(private readonly db: TenantPrismaService) {}

  async findAll(query?: PaginationQueryDto) {
    const take = query?.take || 20;
    const skip = query?.skip || 0;
    return this.db.exec(async (tx) => {
      const [logs, total] = await Promise.all([
        tx.auditLog.findMany({
          orderBy: { id: 'desc' },
          take,
          skip,
        }),
        tx.auditLog.count(),
      ]);
      
      const mapped = logs.map(log => ({
        ...log,
        id: log.id.toString(),
      }));

      return new PaginatedResponseDto(mapped, total, query?.page || 1, query?.limit || 20);
    });
  }
}
