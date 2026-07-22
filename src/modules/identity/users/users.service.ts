import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { CryptoService } from '../../../security/crypto.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { UserQueryDto } from './dto/user-query.dto.js';
import { RefreshTokenService } from '../auth/refresh-token.service.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    @Inject(forwardRef(() => RefreshTokenService)) private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * Find user by email for authentication purposes.
   * Mandates tenantId to prevent cross-tenant account resolution.
   */
  async findByEmail(email: string, tenantId?: string) {
    if (!tenantId) {
      throw new BadRequestException('Mandatory tenant identifier required for pre-authentication lookup');
    }
    return this.prisma.user.findFirst({
      where: { email, tenantId },
    });
  }

  async findTenantBySubdomain(subdomain: string) {
    return this.prisma.tenant.findUnique({
      where: { subdomain },
    });
  }

  async findTenantById(id: string) {
    return this.prisma.tenant.findUnique({
      where: { id },
    });
  }

  async findAllUserIdsByTenantId(tenantId: string): Promise<string[]> {
    return this.db.exec(async (tx) => {
      const users = await tx.user.findMany({
        where: { tenantId },
        select: { id: true },
      });
      return users.map(u => u.id);
    });
  }

  async findAll(query?: UserQueryDto) {
    const take = query?.take || query?.limit || 20;
    const skip = query?.skip || ((query?.page ? query.page - 1 : 0) * take) || 0;
    return this.db.exec(async (tx) => {
      const where: Prisma.UserWhereInput = {};
      if (query?.roleId) where.roleId = query.roleId;
      if (query?.status) where.status = query.status;

      const [items, total] = await Promise.all([
        tx.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        tx.user.count({ where }),
      ]);
      return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
    });
  }


  async findById(id: string) {
    const user = await this.db.exec(async (tx) => {
      return tx.user.findUnique({
        where: { id },
      });
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async create(data: { email: string; passwordHash: string; name: string; roleId: string; tenantId: string }) {
    return this.db.exec(async (tx) => {
      return tx.user.create({
        data,
      });
    });
  }

  async createUser(data: { email: string; password: string; name: string; roleId?: string }) {
    const passwordHash = await this.crypto.hashPassword(data.password);
    const store = requestContextStorage.getStore();
    const tenantId = store?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant context is required to create a user');
    }

    return this.db.exec(async (tx) => {
      return tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          name: data.name,
          roleId: data.roleId || 'staff',
          tenantId,
          status: 'ACTIVE',
        },
      });
    });
  }

  async update(id: string, data: { name?: string; email?: string; roleId?: string; status?: string }) {
    const existing = await this.findById(id);
    const updated = await this.db.exec(async (tx) => {
      return tx.user.update({
        where: { id },
        data,
      });
    });
    if (data.status && data.status !== 'ACTIVE') {
      await this.refreshTokenService.revokeAllUserTokens(existing.tenantId, existing.id);
    }
    return updated;
  }

  async remove(id: string) {
    const existing = await this.findById(id);
    const deleted = await this.db.exec(async (tx) => {
      return tx.user.delete({
        where: { id },
      });
    });
    await this.refreshTokenService.revokeAllUserTokens(existing.tenantId, existing.id);
    return deleted;
  }
}
