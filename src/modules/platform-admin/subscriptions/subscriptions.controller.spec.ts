import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let mockSubscriptionsService: any;

  const mockPlan = {
    id: 'plan-123',
    name: 'Growth Plan',
    code: 'GROWTH',
    price: 299,
  };

  const mockPaginated = {
    data: [mockPlan],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  beforeEach(async () => {
    mockSubscriptionsService = {
      findAllPlans: jest.fn().mockResolvedValue(mockPaginated),
      createPlan: jest.fn().mockResolvedValue(mockPlan),
      findAllSubscriptions: jest.fn().mockResolvedValue(mockPaginated),
      createSubscription: jest.fn().mockResolvedValue({ id: 'sub-123', planId: 'plan-123' }),
      findAllInvoices: jest.fn().mockResolvedValue(mockPaginated),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAllPlans', () => {
    it('should return paginated plans', async () => {
      const result = await controller.findAllPlans();
      expect(result).toEqual(mockPaginated);
      expect(mockSubscriptionsService.findAllPlans).toHaveBeenCalledWith(undefined);
    });
  });

  describe('createPlan', () => {
    it('should create a new plan', async () => {
      const dto = { name: 'Growth Plan', code: 'GROWTH', price: 299 } as any;
      const result = await controller.createPlan(dto);
      expect(result).toEqual(mockPlan);
      expect(mockSubscriptionsService.createPlan).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAllSubscriptions', () => {
    it('should return paginated subscriptions', async () => {
      const result = await controller.findAllSubscriptions();
      expect(result).toEqual(mockPaginated);
      expect(mockSubscriptionsService.findAllSubscriptions).toHaveBeenCalledWith(undefined);
    });
  });

  describe('createSubscription', () => {
    it('should assign a plan to a tenant', async () => {
      const dto = { tenantId: 'tenant-123', planId: 'plan-123' } as any;
      const result = await controller.createSubscription(dto);
      expect(result).toEqual({ id: 'sub-123', planId: 'plan-123' });
      expect(mockSubscriptionsService.createSubscription).toHaveBeenCalledWith('tenant-123', 'plan-123');
    });
  });

  describe('findAllInvoices', () => {
    it('should return paginated invoices', async () => {
      const result = await controller.findAllInvoices();
      expect(result).toEqual(mockPaginated);
      expect(mockSubscriptionsService.findAllInvoices).toHaveBeenCalledWith(undefined);
    });
  });
});
