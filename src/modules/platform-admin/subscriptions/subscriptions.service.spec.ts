import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { NotFoundException } from '@nestjs/common';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let mockPrismaService: any;

  const mockPlan = {
    id: 'plan-123',
    name: 'Growth Plan',
    code: 'GROWTH',
    price: 299,
    currency: 'SAR',
    billingCycle: 'MONTHLY',
    maxUsers: 10,
    maxProducts: 1000,
    maxOrders: 20000,
  };

  const mockSubscription = {
    id: 'sub-123',
    tenantId: 'tenant-123',
    planId: 'plan-123',
    status: 'ACTIVE',
    startDate: new Date(),
    renewalDate: new Date(),
    plan: mockPlan,
  };

  const mockInvoice = {
    id: 'inv-123',
    tenantId: 'tenant-123',
    subscriptionId: 'sub-123',
    amount: 299,
    currency: 'SAR',
    status: 'PAID',
    paidAt: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      subscriptionPlan: {
        findMany: jest.fn().mockResolvedValue([mockPlan]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(mockPlan),
        create: jest.fn().mockResolvedValue(mockPlan),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([mockSubscription]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue(mockSubscription),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([mockInvoice]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue(mockInvoice),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllPlans', () => {
    it('should return paginated subscription plans', async () => {
      const result = await service.findAllPlans({ page: 1, limit: 10 } as any);
      expect(result.data).toEqual([mockPlan]);
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
      expect(mockPrismaService.subscriptionPlan.findMany).toHaveBeenCalled();
    });
  });

  describe('createPlan', () => {
    it('should create a subscription plan', async () => {
      const dto = {
        name: 'Growth Plan',
        code: 'growth',
        price: 299,
      };
      const result = await service.createPlan(dto);
      expect(result).toEqual(mockPlan);
      expect(mockPrismaService.subscriptionPlan.create).toHaveBeenCalledWith({
        data: {
          name: 'Growth Plan',
          code: 'GROWTH',
          price: 299,
          currency: 'SAR',
          billingCycle: 'MONTHLY',
          maxUsers: 5,
          maxProducts: 500,
          maxOrders: 10000,
          features: undefined,
        },
      });
    });
  });

  describe('findAllSubscriptions', () => {
    it('should return paginated subscriptions', async () => {
      const result = await service.findAllSubscriptions({ page: 1, limit: 20 } as any);
      expect(result.data).toEqual([mockSubscription]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });
  });

  describe('createSubscription', () => {
    it('should create subscription and initial paid invoice if plan exists', async () => {
      const result = await service.createSubscription('tenant-123', 'plan-123');
      expect(result).toEqual(mockSubscription);
      expect(mockPrismaService.subscription.create).toHaveBeenCalled();
      expect(mockPrismaService.invoice.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if plan does not exist', async () => {
      mockPrismaService.subscriptionPlan.findUnique.mockResolvedValueOnce(null);
      await expect(service.createSubscription('tenant-123', 'invalid-plan')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllInvoices', () => {
    it('should return paginated invoices', async () => {
      const result = await service.findAllInvoices({ page: 1, limit: 20 } as any);
      expect(result.data).toEqual([mockInvoice]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });
  });
});
