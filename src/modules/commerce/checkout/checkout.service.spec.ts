import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutService } from './checkout.service.js';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CheckoutStatus, CartStatus } from '@prisma/client';
import { TaxCalculator } from './abstractions/tax-calculator.interface.js';
import { ShippingCalculator } from './abstractions/shipping-calculator.interface.js';
import { CouponVerifier } from './abstractions/coupon-verifier.interface.js';

interface MockCheckout {
  id: string;
  tenantId: string;
  storeId: string;
  cartId: string;
  customerId: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  status: CheckoutStatus;
  customerInfo?: Record<string, unknown> | null;
  billingAddress?: Record<string, unknown> | null;
  shippingAddress?: Record<string, unknown> | null;
  shippingMethod?: Record<string, unknown> | null;
  couponCode?: string | null;
  expiresAt: Date | null;
  cart?: MockCart;
}

interface MockCart {
  id: string;
  tenantId: string;
  storeId: string;
  customerId: string | null;
  currency: string;
  status: CartStatus;
  items: MockCartItem[];
}

interface MockCartItem {
  id: string;
  tenantId: string;
  cartId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
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

const createMockCheckout = (overrides?: Partial<MockCheckout>): MockCheckout => ({
  id: 'chk-123',
  tenantId: 'global',
  storeId: 'store-123',
  cartId: 'cart-123',
  customerId: 'cust-123',
  currency: 'USD',
  subtotal: 100,
  discount: 0,
  tax: 15,
  shipping: 10,
  total: 125,
  status: CheckoutStatus.DRAFT,
  customerInfo: { email: 'john@example.com', name: 'John Doe' },
  billingAddress: { street: '123 Main St', city: 'Baghdad', country: 'Iraq' },
  shippingAddress: { street: '123 Main St', city: 'Baghdad', country: 'Iraq' },
  shippingMethod: { code: 'standard', price: 10 },
  couponCode: null,
  expiresAt: new Date(Date.now() + 1800000),
  cart: {
    id: 'cart-123',
    tenantId: 'global',
    storeId: 'store-123',
    customerId: 'cust-123',
    currency: 'USD',
    status: CartStatus.ACTIVE,
    items: [
      {
        id: 'item-1',
        tenantId: 'global',
        cartId: 'cart-123',
        variantId: 'var-1',
        quantity: 2,
        unitPrice: 50,
        subtotal: 100,
        variant: {
          id: 'var-1',
          price: 50,
          productId: 'prod-1',
          product: {
            id: 'prod-1',
            tenantId: 'global',
            storeId: 'store-123',
            isPublished: true,
            deletedAt: null,
          },
        },
      },
    ],
  },
  ...overrides,
});

type TxCallback<T> = (tx: MockPrismaTx) => Promise<T>;

interface MockPrismaTx {
  checkout: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  cart: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  stockLevel: {
    findMany: jest.Mock;
  };
}

describe('CheckoutService', () => {
  let service: CheckoutService;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockTaxCalculator: jest.Mocked<TaxCalculator>;
  let mockShippingCalculator: jest.Mocked<ShippingCalculator>;
  let mockCouponVerifier: jest.Mocked<CouponVerifier>;
  let mockTx: MockPrismaTx;
  let mockTenantPrismaService: { exec: jest.Mock };

  beforeEach(async () => {
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CacheService>;

    mockTaxCalculator = {
      calculateTax: jest.fn().mockResolvedValue(15),
    };

    mockShippingCalculator = {
      calculateShipping: jest.fn().mockResolvedValue(10),
    };

    mockCouponVerifier = {
      verifyAndCalculateDiscount: jest.fn().mockResolvedValue({ valid: true, discountAmount: 10, message: 'Success' }),
    };

    const defaultCheckout = createMockCheckout();

    mockTx = {
      checkout: {
        findFirst: jest.fn().mockResolvedValue(defaultCheckout),
        create: jest.fn().mockResolvedValue(defaultCheckout),
        update: jest.fn().mockResolvedValue(defaultCheckout),
      },
      cart: {
        findFirst: jest.fn().mockResolvedValue(defaultCheckout.cart),
        update: jest.fn().mockResolvedValue(defaultCheckout.cart),
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
        CheckoutService,
        { provide: TenantPrismaService, useValue: mockTenantPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: 'TAX_CALCULATOR', useValue: mockTaxCalculator },
        { provide: 'SHIPPING_CALCULATOR', useValue: mockShippingCalculator },
        { provide: 'COUPON_VERIFIER', useValue: mockCouponVerifier },
      ],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCheckout', () => {
    it('should create checkout session for valid active cart', async () => {
      const result = await service.createCheckout({ cartId: 'cart-123' });

      expect(result.id).toBe('chk-123');
      expect(result.status).toBe(CheckoutStatus.DRAFT);
      expect(mockTx.checkout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cartId: 'cart-123',
            tenantId: 'global',
            status: CheckoutStatus.DRAFT,
          }),
        }),
      );
    });

    it('should throw NotFoundException if cart does not exist or is inactive', async () => {
      mockTx.cart.findFirst.mockResolvedValueOnce(null);

      await expect(service.createCheckout({ cartId: 'invalid-cart' })).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if cart is empty', async () => {
      const emptyCart = { ...createMockCheckout().cart, items: [] };
      mockTx.cart.findFirst.mockResolvedValueOnce(emptyCart);

      await expect(service.createCheckout({ cartId: 'cart-123' })).rejects.toThrow(
        'Cannot create checkout session for an empty cart',
      );
    });

    it('should throw BadRequestException if product in cart is unpublished', async () => {
      const unpublishedCart = {
        ...createMockCheckout().cart,
        items: [
          {
            id: 'item-1',
            tenantId: 'global',
            cartId: 'cart-123',
            variantId: 'var-1',
            quantity: 1,
            unitPrice: 50,
            subtotal: 50,
            variant: {
              id: 'var-1',
              price: 50,
              productId: 'prod-1',
              product: {
                id: 'prod-1',
                tenantId: 'global',
                storeId: 'store-123',
                isPublished: false,
                deletedAt: null,
              },
            },
          },
        ],
      };
      mockTx.cart.findFirst.mockResolvedValueOnce(unpublishedCart);

      await expect(service.createCheckout({ cartId: 'cart-123' })).rejects.toThrow('is unpublished');
    });

    it('should throw BadRequestException if stock is insufficient', async () => {
      mockTx.stockLevel.findMany.mockResolvedValueOnce([{ quantityPhysical: 1, quantityReserved: 0 }]);

      await expect(service.createCheckout({ cartId: 'cart-123' })).rejects.toThrow('Insufficient stock');
    });
  });

  describe('getCheckout', () => {
    it('should return cached checkout session on cache hit without database query', async () => {
      const checkout = createMockCheckout();
      mockCacheService.get.mockResolvedValueOnce(checkout);

      const result = await service.getCheckout('chk-123');

      expect(result).toEqual(checkout);
      expect(mockTenantPrismaService.exec).not.toHaveBeenCalled();
    });

    it('should query database, populate cache, and return checkout on cache miss', async () => {
      const checkout = createMockCheckout();
      mockTx.checkout.findFirst.mockResolvedValueOnce(checkout);

      const result = await service.getCheckout('chk-123');

      expect(result).toEqual(checkout);
      expect(mockCacheService.set).toHaveBeenCalledWith('tenant:global:checkout:chk-123', checkout, 300);
    });

    it('should mark session EXPIRED and throw BadRequestException if expiresAt has passed', async () => {
      const expiredCheckout = createMockCheckout({
        expiresAt: new Date(Date.now() - 10000),
      });
      mockTx.checkout.findFirst.mockResolvedValueOnce(expiredCheckout);

      await expect(service.getCheckout('chk-123')).rejects.toThrow('Checkout session has expired');
      expect(mockTx.checkout.update).toHaveBeenCalledWith({
        where: { id: 'chk-123' },
        data: { status: CheckoutStatus.EXPIRED },
      });
    });
  });

  describe('updateCustomer & updateAddresses & updateShippingMethod', () => {
    it('should update customer info, change status to IN_PROGRESS, and invalidate cache', async () => {
      const updated = await service.updateCustomer('chk-123', {
        email: 'jane@example.com',
        name: 'Jane Doe',
      });

      expect(updated).toBeDefined();
      expect(mockTx.checkout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CheckoutStatus.IN_PROGRESS,
            customerInfo: { email: 'jane@example.com', name: 'Jane Doe', phone: null },
          }),
        }),
      );
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('tenant:global:checkout:chk-123');
    });

    it('should update addresses and recalculate tax', async () => {
      const address = { street: '456 Karrada St', city: 'Baghdad', country: 'Iraq' };

      await service.updateAddresses('chk-123', { shippingAddress: address });

      expect(mockTx.checkout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingAddress: address,
            billingAddress: address,
            status: CheckoutStatus.IN_PROGRESS,
          }),
        }),
      );
      expect(mockTaxCalculator.calculateTax).toHaveBeenCalled();
    });

    it('should update shipping method and calculate shipping cost via abstraction', async () => {
      mockShippingCalculator.calculateShipping.mockResolvedValueOnce(25);

      await service.updateShippingMethod('chk-123', { shippingMethodCode: 'express' });

      expect(mockShippingCalculator.calculateShipping).toHaveBeenCalledWith('express', 1, expect.anything());
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('tenant:global:checkout:chk-123');
    });
  });

  describe('applyCoupon & removeCoupon', () => {
    it('should apply valid coupon and recalculate total discount', async () => {
      mockCouponVerifier.verifyAndCalculateDiscount.mockResolvedValueOnce({
        valid: true,
        discountAmount: 10,
        message: '10% off',
      });

      await service.applyCoupon('chk-123', { couponCode: 'SAVE10' });

      expect(mockTx.checkout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            couponCode: 'SAVE10',
            discount: 10,
          }),
        }),
      );
    });

    it('should throw BadRequestException if coupon code is invalid', async () => {
      mockCouponVerifier.verifyAndCalculateDiscount.mockResolvedValueOnce({
        valid: false,
        discountAmount: 0,
        message: 'Invalid code',
      });

      await expect(service.applyCoupon('chk-123', { couponCode: 'INVALID' })).rejects.toThrow(BadRequestException);
    });

    it('should remove coupon and reset discount to 0', async () => {
      await service.removeCoupon('chk-123');

      expect(mockTx.checkout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            couponCode: null,
            discount: 0,
          }),
        }),
      );
    });
  });

  describe('validateCheckout & confirmCheckout', () => {
    it('should return valid true when all required fields and stock are present', async () => {
      const result = await service.validateCheckout('chk-123');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid false with errors list when customerInfo or addresses missing', async () => {
      const incompleteCheckout = createMockCheckout({
        customerInfo: null,
        shippingAddress: null,
      });
      mockTx.checkout.findFirst.mockResolvedValueOnce(incompleteCheckout);

      const result = await service.validateCheckout('chk-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Customer information is missing');
      expect(result.errors).toContain('Shipping address is missing');
    });

    it('should confirm checkout, mark checkout COMPLETED, and convert cart status to CONVERTED', async () => {
      const result = await service.confirmCheckout('chk-123');

      expect(result.success).toBe(true);
      expect(result.orderReady).toBe(true);
      expect(mockTx.checkout.update).toHaveBeenCalledWith({
        where: { id: 'chk-123' },
        data: { status: CheckoutStatus.COMPLETED },
      });
      expect(mockTx.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-123' },
        data: { status: CartStatus.CONVERTED },
      });
    });
  });
});
