import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';

describe('CheckoutController', () => {
  let controller: CheckoutController;
  let mockCheckoutService: jest.Mocked<CheckoutService>;

  const mockCheckout = {
    id: 'chk-123',
    tenantId: 'tenant-123',
    storeId: 'store-123',
    cartId: 'cart-123',
    status: 'DRAFT',
    total: 125,
  };

  beforeEach(async () => {
    mockCheckoutService = {
      createCheckout: jest.fn().mockResolvedValue(mockCheckout),
      getCheckout: jest.fn().mockResolvedValue(mockCheckout),
      updateCustomer: jest.fn().mockResolvedValue(mockCheckout),
      updateAddresses: jest.fn().mockResolvedValue(mockCheckout),
      updateShippingMethod: jest.fn().mockResolvedValue(mockCheckout),
      applyCoupon: jest.fn().mockResolvedValue(mockCheckout),
      removeCoupon: jest.fn().mockResolvedValue(mockCheckout),
      validateCheckout: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
      calculateTotals: jest.fn().mockResolvedValue(mockCheckout),
      confirmCheckout: jest.fn().mockResolvedValue({ success: true, checkoutId: 'chk-123', orderReady: true }),
      expireCheckout: jest.fn().mockResolvedValue({ ...mockCheckout, status: 'EXPIRED' }),
    } as unknown as jest.Mocked<CheckoutService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckoutController],
      providers: [
        { provide: CheckoutService, useValue: mockCheckoutService },
      ],
    }).compile();

    controller = module.get<CheckoutController>(CheckoutController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createCheckout', () => {
    it('should create checkout session', async () => {
      const dto = { cartId: 'cart-123' };
      const result = await controller.createCheckout(dto);

      expect(result).toEqual(mockCheckout);
      expect(mockCheckoutService.createCheckout).toHaveBeenCalledWith(dto);
    });
  });

  describe('getCheckout', () => {
    it('should return checkout session details', async () => {
      const result = await controller.getCheckout('chk-123');

      expect(result).toEqual(mockCheckout);
      expect(mockCheckoutService.getCheckout).toHaveBeenCalledWith('chk-123');
    });
  });

  describe('updateCustomer', () => {
    it('should update customer info', async () => {
      const dto = { email: 'test@example.com', name: 'Test User' };
      const result = await controller.updateCustomer('chk-123', dto);

      expect(result).toEqual(mockCheckout);
      expect(mockCheckoutService.updateCustomer).toHaveBeenCalledWith('chk-123', dto);
    });
  });

  describe('updateAddresses', () => {
    it('should update shipping & billing addresses', async () => {
      const dto = { shippingAddress: { street: 'Main St', city: 'Baghdad', country: 'Iraq' } };
      const result = await controller.updateAddresses('chk-123', dto);

      expect(result).toEqual(mockCheckout);
      expect(mockCheckoutService.updateAddresses).toHaveBeenCalledWith('chk-123', dto);
    });
  });

  describe('updateShippingMethod', () => {
    it('should update shipping method', async () => {
      const dto = { shippingMethodCode: 'express' };
      const result = await controller.updateShippingMethod('chk-123', dto);

      expect(result).toEqual(mockCheckout);
      expect(mockCheckoutService.updateShippingMethod).toHaveBeenCalledWith('chk-123', dto);
    });
  });

  describe('applyCoupon & removeCoupon', () => {
    it('should apply coupon', async () => {
      const dto = { couponCode: 'SAVE10' };
      const result = await controller.applyCoupon('chk-123', dto);

      expect(result).toEqual(mockCheckout);
      expect(mockCheckoutService.applyCoupon).toHaveBeenCalledWith('chk-123', dto);
    });

    it('should remove coupon', async () => {
      const result = await controller.removeCoupon('chk-123');

      expect(result).toEqual(mockCheckout);
      expect(mockCheckoutService.removeCoupon).toHaveBeenCalledWith('chk-123');
    });
  });

  describe('validateCheckout & confirmCheckout & expireCheckout', () => {
    it('should return validation result', async () => {
      const result = await controller.validateCheckout('chk-123');

      expect(result).toEqual({ valid: true, errors: [] });
      expect(mockCheckoutService.validateCheckout).toHaveBeenCalledWith('chk-123');
    });

    it('should confirm checkout', async () => {
      const result = await controller.confirmCheckout('chk-123');

      expect(result).toEqual({ success: true, checkoutId: 'chk-123', orderReady: true });
      expect(mockCheckoutService.confirmCheckout).toHaveBeenCalledWith('chk-123');
    });

    it('should expire checkout', async () => {
      const result = await controller.expireCheckout('chk-123');

      expect(result).toEqual({ ...mockCheckout, status: 'EXPIRED' });
      expect(mockCheckoutService.expireCheckout).toHaveBeenCalledWith('chk-123');
    });
  });
});
