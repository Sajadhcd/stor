import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let mockPaymentsService: jest.Mocked<Partial<PaymentsService>>;

  const mockPayment = {
    id: 'pay-123',
    orderId: 'ord-123',
    provider: 'qicard',
    amount: 150,
    currency: 'USD',
    status: 'PENDING',
  };

  const mockPaginated = {
    data: [mockPayment],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  beforeEach(async () => {
    mockPaymentsService = {
      listPayments: jest.fn().mockResolvedValue(mockPaginated),
      getPayment: jest.fn().mockResolvedValue(mockPayment),
      createPaymentIntent: jest.fn().mockResolvedValue(mockPayment),
      initiatePayment: jest.fn().mockResolvedValue(mockPayment),
      confirmPayment: jest.fn().mockResolvedValue({ ...mockPayment, status: 'PAID' }),
      cancelPayment: jest.fn().mockResolvedValue({ ...mockPayment, status: 'CANCELLED' }),
      refundPayment: jest.fn().mockResolvedValue({ ...mockPayment, status: 'REFUNDED' }),
      retryPayment: jest.fn().mockResolvedValue(mockPayment),
      validatePayment: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
      processWebhook: jest.fn().mockResolvedValue({ success: true, eventId: 'evt-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: mockPaymentsService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listPayments', () => {
    it('should return paginated payments list', async () => {
      const query = { page: 1, limit: 20, skip: 0, take: 20 };
      const result = await controller.listPayments(query);
      expect(result).toEqual(mockPaginated);
      expect(mockPaymentsService.listPayments).toHaveBeenCalledWith(query);
    });
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent', async () => {
      const dto = { orderId: 'ord-123', provider: 'qicard', amount: 150 };
      const result = await controller.createPaymentIntent(dto);
      expect(result).toEqual(mockPayment);
      expect(mockPaymentsService.createPaymentIntent).toHaveBeenCalledWith(dto);
    });
  });

  describe('confirmPayment', () => {
    it('should confirm payment', async () => {
      const result = await controller.confirmPayment('pay-123', { externalTransactionId: 'tx-1' });
      expect(result.status).toBe('PAID');
      expect(mockPaymentsService.confirmPayment).toHaveBeenCalledWith('pay-123', { externalTransactionId: 'tx-1' });
    });
  });

  describe('handleWebhook', () => {
    it('should process webhook payload and signature', async () => {
      const payload = { id: 'evt-1' };
      const result = await controller.handleWebhook('qicard', payload, 'sig-123');
      expect(result).toEqual({ success: true, eventId: 'evt-123' });
      expect(mockPaymentsService.processWebhook).toHaveBeenCalledWith('qicard', payload, 'sig-123', undefined, undefined);
    });
  });
});
