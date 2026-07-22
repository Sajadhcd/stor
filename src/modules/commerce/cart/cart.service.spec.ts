import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service.js';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CartStatus } from '@prisma/client';

interface MockCart {
  id: string;
  tenantId: string;
  storeId: string;
  customerId: string | null;
  sessionId: string | null;
  status: CartStatus;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  items: MockCartItem[];
}

interface MockCartItem {
  id: string;
  tenantId: string;
  cartId: string;
  productId: string | null;
  variantId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  metadata?: Record<string, unknown>;
  variant?: {
    id: string;
    price: number;
    productId: string;
    product?: {
      id: string;
      tenantId: string;
      storeId: string;
      isPublished: boolean;
      deletedAt: Date | null;
    };
  };
}

const createMockCart = (overrides?: Partial<MockCart>): MockCart => ({
  id: 'cart-123',
  tenantId: 'tenant-123',
  storeId: 'store-123',
  customerId: 'cust-123',
  sessionId: null,
  status: CartStatus.ACTIVE,
  currency: 'USD',
  subtotal: 100,
  discount: 0,
  tax: 15,
  shipping: 10,
  total: 125,
  items: [],
  ...overrides,
});

const createMockCartItem = (overrides?: Partial<MockCartItem>): MockCartItem => ({
  id: 'item-123',
  tenantId: 'global',
  cartId: 'cart-123',
  productId: 'prod-123',
  variantId: 'var-123',
  quantity: 2,
  unitPrice: 50,
  subtotal: 100,
  variant: {
    id: 'var-123',
    price: 50,
    productId: 'prod-123',
    product: {
      id: 'prod-123',
      tenantId: 'global',
      storeId: 'store-123',
      isPublished: true,
      deletedAt: null,
    },
  },
  ...overrides,
});

type TxCallback<T> = (tx: MockPrismaTx) => Promise<T>;

interface MockPrismaTx {
  cart: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  cartItem: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  store: {
    findFirst: jest.Mock;
  };
  productVariant: {
    findFirst: jest.Mock;
  };
  stockLevel: {
    findMany: jest.Mock;
  };
}

describe('CartService', () => {
  let service: CartService;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockTx: MockPrismaTx;
  let mockTenantPrismaService: { exec: jest.Mock };

  beforeEach(async () => {
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CacheService>;

    const defaultCart = createMockCart();
    const defaultItem = createMockCartItem();

    mockTx = {
      cart: {
        findFirst: jest.fn().mockResolvedValue(defaultCart),
        create: jest.fn().mockResolvedValue(defaultCart),
        update: jest.fn().mockResolvedValue(defaultCart),
      },
      cartItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([defaultItem]),
        create: jest.fn().mockResolvedValue(defaultItem),
        update: jest.fn().mockResolvedValue(defaultItem),
        delete: jest.fn().mockResolvedValue(defaultItem),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      store: {
        findFirst: jest.fn().mockResolvedValue({ id: 'store-123', tenantId: 'tenant-123', currency: 'USD' }),
      },
      productVariant: {
        findFirst: jest.fn().mockResolvedValue(defaultItem.variant),
      },
      stockLevel: {
        findMany: jest.fn().mockResolvedValue([{ quantityPhysical: 100, quantityReserved: 0 }]),
      },
    };

    mockTenantPrismaService = {
      exec: jest.fn().mockImplementation(<T>(cb: TxCallback<T>) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: TenantPrismaService, useValue: mockTenantPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCart', () => {
    it('should create a new customer cart when no active cart exists', async () => {
      mockTx.cart.findFirst.mockResolvedValueOnce(null);
      const newCart = createMockCart({ customerId: 'cust-123' });
      mockTx.cart.create.mockResolvedValueOnce(newCart);

      const result = await service.createCart({ storeId: 'store-123', customerId: 'cust-123' });

      expect(result).toEqual(newCart);
      expect(mockTx.store.findFirst).toHaveBeenCalledWith({
        where: { id: 'store-123', tenantId: 'global' },
      });
    });

    it('should return existing active cart if customer already has an active cart for store', async () => {
      const existingCart = createMockCart({ customerId: 'cust-123' });
      mockTx.cart.findFirst.mockResolvedValueOnce(existingCart);

      const result = await service.createCart({ storeId: 'store-123', customerId: 'cust-123' });

      expect(result).toEqual(existingCart);
      expect(mockTx.cart.create).not.toHaveBeenCalled();
    });

    it('should create guest cart when sessionId is provided', async () => {
      mockTx.cart.findFirst.mockResolvedValueOnce(null);
      const guestCart = createMockCart({ customerId: null, sessionId: 'sess-999' });
      mockTx.cart.create.mockResolvedValueOnce(guestCart);

      const result = await service.createCart({ storeId: 'store-123', sessionId: 'sess-999' });

      expect(result).toEqual(guestCart);
    });

    it('should throw NotFoundException if store does not exist for tenant', async () => {
      mockTx.store.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.createCart({ storeId: 'invalid-store', customerId: 'cust-123' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCart', () => {
    it('should return cached cart on cache hit without querying database', async () => {
      const cart = createMockCart();
      mockCacheService.get.mockResolvedValueOnce(cart);

      const result = await service.getCart('cart-123');

      expect(result).toEqual(cart);
      expect(mockTenantPrismaService.exec).not.toHaveBeenCalled();
    });

    it('should query database, populate cache, and filter valid items on cache miss', async () => {
      const itemValid = createMockCartItem({ id: 'item-1' });
      const cart = createMockCart({ items: [itemValid] });
      mockTx.cart.findFirst.mockResolvedValueOnce(cart);

      const result = await service.getCart('cart-123');

      expect(result.id).toBe('cart-123');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'tenant:global:cart:cart-123',
        expect.anything(),
        300,
      );
    });

    it('should throw NotFoundException if active cart does not exist', async () => {
      mockTx.cart.findFirst.mockResolvedValueOnce(null);

      await expect(service.getCart('missing-cart')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addItem', () => {
    it('should add item to cart, validate inventory, calculate totals, and invalidate cache', async () => {
      const cart = createMockCart();
      const variant = createMockCartItem().variant;

      mockTx.cart.findFirst.mockResolvedValueOnce(cart);
      mockTx.productVariant.findFirst.mockResolvedValueOnce(variant);
      mockTx.cartItem.findFirst.mockResolvedValueOnce(null);

      await service.addItem('cart-123', { variantId: 'var-123', quantity: 2 });

      expect(mockTx.cartItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cartId: 'cart-123',
            variantId: 'var-123',
            quantity: 2,
            unitPrice: 50,
          }),
        }),
      );
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('tenant:global:cart:cart-123');
    });

    it('should merge quantity when item for same variant already exists in cart', async () => {
      const cart = createMockCart();
      const existingItem = createMockCartItem({ quantity: 2, subtotal: 100 });
      const variant = existingItem.variant;

      mockTx.cart.findFirst.mockResolvedValueOnce(cart);
      mockTx.productVariant.findFirst.mockResolvedValueOnce(variant);
      mockTx.cartItem.findFirst.mockResolvedValueOnce(existingItem);

      await service.addItem('cart-123', { variantId: 'var-123', quantity: 3 });

      expect(mockTx.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'item-123' },
        data: expect.objectContaining({
          quantity: 5,
          subtotal: 250,
        }),
      });
    });

    it('should throw BadRequestException for invalid quantity <= 0', async () => {
      await expect(
        service.addItem('cart-123', { variantId: 'var-123', quantity: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if product is unpublished', async () => {
      const cart = createMockCart();
      const unpublishedVariant = {
        id: 'var-123',
        price: 50,
        productId: 'prod-123',
        product: {
          id: 'prod-123',
          tenantId: 'global',
          storeId: 'store-123',
          isPublished: false,
          deletedAt: null,
        },
      };

      mockTx.cart.findFirst.mockResolvedValueOnce(cart);
      mockTx.productVariant.findFirst.mockResolvedValueOnce(unpublishedVariant);

      await expect(
        service.addItem('cart-123', { variantId: 'var-123', quantity: 1 }),
      ).rejects.toThrow('Cannot add unpublished product to cart');
    });

    it('should throw BadRequestException if product is soft deleted', async () => {
      const cart = createMockCart();
      const deletedVariant = {
        id: 'var-123',
        price: 50,
        productId: 'prod-123',
        product: {
          id: 'prod-123',
          tenantId: 'global',
          storeId: 'store-123',
          isPublished: true,
          deletedAt: new Date(),
        },
      };

      mockTx.cart.findFirst.mockResolvedValueOnce(cart);
      mockTx.productVariant.findFirst.mockResolvedValueOnce(deletedVariant);

      await expect(
        service.addItem('cart-123', { variantId: 'var-123', quantity: 1 }),
      ).rejects.toThrow('Cannot add deleted product to cart');
    });

    it('should throw BadRequestException if stock is insufficient', async () => {
      const cart = createMockCart();
      const variant = createMockCartItem().variant;

      mockTx.cart.findFirst.mockResolvedValueOnce(cart);
      mockTx.productVariant.findFirst.mockResolvedValueOnce(variant);
      mockTx.stockLevel.findMany.mockResolvedValueOnce([{ quantityPhysical: 2, quantityReserved: 1 }]);

      await expect(
        service.addItem('cart-123', { variantId: 'var-123', quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateItem & removeItem & clearCart', () => {
    it('should update item quantity and recalculate totals', async () => {
      const cart = createMockCart();
      const item = createMockCartItem();

      mockTx.cart.findFirst.mockResolvedValueOnce(cart);
      mockTx.cartItem.findFirst.mockResolvedValueOnce(item);

      await service.updateItem('cart-123', 'item-123', { quantity: 4 });

      expect(mockTx.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'item-123' },
        data: expect.objectContaining({ quantity: 4, subtotal: 200 }),
      });
    });

    it('should remove item from cart and recalculate totals', async () => {
      const cart = createMockCart();
      const item = createMockCartItem();

      mockTx.cart.findFirst.mockResolvedValueOnce(cart);
      mockTx.cartItem.findFirst.mockResolvedValueOnce(item);

      await service.removeItem('cart-123', 'item-123');

      expect(mockTx.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'item-123' } });
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('tenant:global:cart:cart-123');
    });

    it('should clear all items from cart and reset totals to 0', async () => {
      const cart = createMockCart();
      mockTx.cart.findFirst.mockResolvedValueOnce(cart);

      await service.clearCart('cart-123');

      expect(mockTx.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-123', tenantId: 'global' },
      });
      expect(mockTx.cart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subtotal: 0, total: 0 }),
        }),
      );
    });
  });

  describe('mergeGuestCart', () => {
    it('should merge guest cart items into customer cart and set guest cart status MERGED', async () => {
      const guestItem = createMockCartItem({ id: 'g-item-1', cartId: 'guest-cart-1' });
      const guestCart = createMockCart({ id: 'guest-cart-1', items: [guestItem] });
      const customerCart = createMockCart({ id: 'cust-cart-1', customerId: 'cust-123', items: [] });

      mockTx.cart.findFirst
        .mockResolvedValueOnce(guestCart)
        .mockResolvedValueOnce(customerCart);

      const result = await service.mergeGuestCart('sess-123', 'cust-123', 'store-123');

      expect(result).toBeDefined();
      expect(mockTx.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'g-item-1' },
        data: { cartId: 'cust-cart-1' },
      });
      expect(mockTx.cart.update).toHaveBeenCalledWith({
        where: { id: 'guest-cart-1' },
        data: { status: CartStatus.MERGED },
      });
    });
  });

  describe('expireCart', () => {
    it('should mark cart EXPIRED and invalidate cache', async () => {
      const cart = createMockCart();
      mockTx.cart.findFirst.mockResolvedValueOnce(cart);

      await service.expireCart('cart-123');

      expect(mockTx.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-123' },
        data: { status: CartStatus.EXPIRED },
      });
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('tenant:global:cart:cart-123');
    });
  });
});
