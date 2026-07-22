import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPlans(query?: PaginationQueryDto) {
    const take = query?.take || 20;
    const skip = query?.skip || 0;
    const [items, total] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({
        orderBy: { price: 'asc' },
        take,
        skip,
      }),
      this.prisma.subscriptionPlan.count(),
    ]);
    return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
  }

  async createPlan(data: {
    name: string;
    code: string;
    price: number;
    currency?: string;
    billingCycle?: string;
    maxUsers?: number;
    maxProducts?: number;
    maxOrders?: number;
    features?: Prisma.InputJsonValue;
  }) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        price: data.price,
        currency: data.currency || 'SAR',
        billingCycle: data.billingCycle || 'MONTHLY',
        maxUsers: data.maxUsers ?? 5,
        maxProducts: data.maxProducts ?? 500,
        maxOrders: data.maxOrders ?? 10000,
        features: data.features,
      },
    });
  }

  async findAllSubscriptions(query?: PaginationQueryDto) {
    const take = query?.take || 20;
    const skip = query?.skip || 0;
    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        include: {
          tenant: true,
          plan: true,
          invoices: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.subscription.count(),
    ]);
    return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
  }

  async createSubscription(tenantId: string, planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan with ID ${planId} not found`);

    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId,
        planId,
        status: 'ACTIVE',
        startDate: new Date(),
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      include: { plan: true },
    });

    // Generate Invoice
    await this.prisma.invoice.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        amount: plan.price,
        currency: plan.currency,
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    return subscription;
  }

  async findAllInvoices(query?: PaginationQueryDto) {
    const take = query?.take || 20;
    const skip = query?.skip || 0;
    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        include: {
          tenant: true,
          subscription: { include: { plan: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.invoice.count(),
    ]);
    return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
  }
}
