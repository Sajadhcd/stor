import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

@Injectable()
export class PlatformAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [totalTenants, activeTenants, totalOrders, totalProducts, revenueAggr] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.order.count(),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.order.aggregate({ _sum: { grandTotal: true } }),
    ]);

    return {
      totalTenants,
      activeTenants,
      totalOrders,
      totalProducts,
      totalRevenue: revenueAggr._sum.grandTotal ? Number(revenueAggr._sum.grandTotal) : 0,
      monthlyGrowth: 18.5,
    };
  }

  async getRevenueChart() {
    return [
      { month: 'يناير', revenue: 45000 },
      { month: 'فبراير', revenue: 58000 },
      { month: 'مارس', revenue: 72000 },
      { month: 'أبريل', revenue: 89000 },
      { month: 'مايو', revenue: 110000 },
      { month: 'يونيو', revenue: 145000 },
    ];
  }

  async getUsageStats() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        _count: {
          select: { users: true, products: true, orders: true },
        },
      },
    });

    return tenants.map((t) => ({
      tenantId: t.id,
      tenantName: t.name,
      usersCount: t._count.users,
      productsCount: t._count.products,
      ordersCount: t._count.orders,
    }));
  }
}
