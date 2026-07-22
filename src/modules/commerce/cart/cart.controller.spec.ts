import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

describe('CartController', () => {
  let controller: CartController;
  let mockCartService: jest.Mocked<CartService>;

  const mockCart = {
    id: 'cart-123',
    tenantId: 'tenant-123',
    storeId: 'store-123',
    customerId: 'cust-123',
    currency: 'USD',
    status: 'ACTIVE',
    items: [],
  };

  beforeEach(async () => {
    mockCartService = {
      createCart: jest.fn().mockResolvedValue(mockCart),
      getCart: jest.fn().mockResolvedValue(mockCart),
      addItem: jest.fn().mockResolvedValue(mockCart),
      updateItem: jest.fn().mockResolvedValue(mockCart),
      removeItem: jest.fn().mockResolvedValue(mockCart),
      clearCart: jest.fn().mockResolvedValue(mockCart),
      mergeGuestCart: jest.fn().mockResolvedValue(mockCart),
      calculateTotals: jest.fn().mockResolvedValue(mockCart),
      validateInventory: jest.fn().mockResolvedValue({ available: true, stockRemaining: 100 }),
      expireCart: jest.fn().mockResolvedValue(mockCart),
    } as unknown as jest.Mocked<CartService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        { provide: CartService, useValue: mockCartService },
      ],
    }).compile();

    controller = module.get<CartController>(CartController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createCart', () => {
    it('should create cart', async () => {
      const dto = { storeId: 'store-123', customerId: 'cust-123' };
      const result = await controller.createCart(dto);

      expect(result).toEqual(mockCart);
      expect(mockCartService.createCart).toHaveBeenCalledWith(dto);
    });
  });

  describe('getCart', () => {
    it('should return cart details', async () => {
      const result = await controller.getCart('cart-123');

      expect(result).toEqual(mockCart);
      expect(mockCartService.getCart).toHaveBeenCalledWith('cart-123');
    });
  });

  describe('addItem', () => {
    it('should add item to cart', async () => {
      const dto = { variantId: 'var-1', quantity: 2 };
      const result = await controller.addItem('cart-123', dto);

      expect(result).toEqual(mockCart);
      expect(mockCartService.addItem).toHaveBeenCalledWith('cart-123', dto);
    });
  });

  describe('updateItem', () => {
    it('should update item quantity', async () => {
      const dto = { quantity: 5 };
      const result = await controller.updateItem('cart-123', 'item-1', dto);

      expect(result).toEqual(mockCart);
      expect(mockCartService.updateItem).toHaveBeenCalledWith('cart-123', 'item-1', dto);
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      const result = await controller.removeItem('cart-123', 'item-1');

      expect(result).toEqual(mockCart);
      expect(mockCartService.removeItem).toHaveBeenCalledWith('cart-123', 'item-1');
    });
  });

  describe('clearCart', () => {
    it('should clear cart items', async () => {
      const result = await controller.clearCart('cart-123');

      expect(result).toEqual(mockCart);
      expect(mockCartService.clearCart).toHaveBeenCalledWith('cart-123');
    });
  });

  describe('mergeCart', () => {
    it('should merge guest cart into customer cart', async () => {
      const dto = { guestSessionIdOrCartId: 'sess-1', storeId: 'store-123', customerId: 'cust-123' };
      const result = await controller.mergeCart(dto);

      expect(result).toEqual(mockCart);
      expect(mockCartService.mergeGuestCart).toHaveBeenCalledWith('sess-1', 'cust-123', 'store-123');
    });
  });
});
