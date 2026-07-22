import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { CheckoutStatus, CartStatus, Prisma } from '@prisma/client';
import { CreateCheckoutDto } from './dto/create-checkout.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { UpdateAddressesDto } from './dto/update-addresses.dto.js';
import { UpdateShippingMethodDto } from './dto/update-shipping-method.dto.js';
import { ApplyCouponDto } from './dto/apply-coupon.dto.js';
import type { TaxCalculator } from './abstractions/tax-calculator.interface.js';
import type { ShippingCalculator } from './abstractions/shipping-calculator.interface.js';
import type { CouponVerifier } from './abstractions/coupon-verifier.interface.js';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cache: CacheService,
    @Inject('TAX_CALCULATOR') private readonly taxCalculator: TaxCalculator,
    @Inject('SHIPPING_CALCULATOR') private readonly shippingCalculator: ShippingCalculator,
    @Inject('COUPON_VERIFIER') private readonly couponVerifier: CouponVerifier,
  ) {}

  private getTenantId(): string {
    const ctx = requestContextStorage.getStore();
    return ctx?.tenantId || 'global';
  }

  async createCheckout(data: CreateCheckoutDto) {
    const tenantId = this.getTenantId();

    return this.db.exec(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: { id: data.cartId, tenantId, status: CartStatus.ACTIVE },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      if (!cart) {
        throw new NotFoundException(`Active Cart with ID ${data.cartId} not found`);
      }

      if (!cart.items || cart.items.length === 0) {
        throw new BadRequestException('Cannot create checkout session for an empty cart');
      }

      // Validate products & stock
      for (const item of cart.items) {
        const product = item.variant?.product;
        if (!product || product.tenantId !== tenantId) {
          throw new BadRequestException(`Product for variant ${item.variantId} belongs to another tenant`);
        }
        if (product.storeId !== cart.storeId) {
          throw new BadRequestException(`Product for variant ${item.variantId} belongs to a different store`);
        }
        if (!product.isPublished) {
          throw new BadRequestException(`Product ${product.id} is unpublished`);
        }
        if (product.deletedAt !== null) {
          throw new BadRequestException(`Product ${product.id} has been deleted`);
        }

        const stockLevels = await (tx as any).stockLevel.findMany({
          where: { variantId: item.variantId, tenantId },
        });
        if (stockLevels && stockLevels.length > 0) {
          const available = stockLevels.reduce(
            (acc: number, stock: any) => acc + (stock.quantityPhysical - stock.quantityReserved),
            0,
          );
          if (available < item.quantity) {
            throw new BadRequestException(`Insufficient stock for variant ${item.variantId}`);
          }
        }
      }

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes TTL
      const subtotal = cart.items.reduce((sum, item) => sum + Number(item.subtotal), 0);

      const checkout = await tx.checkout.create({
        data: {
          tenantId,
          storeId: cart.storeId,
          cartId: cart.id,
          customerId: data.customerId || cart.customerId || null,
          currency: cart.currency || 'USD',
          subtotal,
          discount: 0,
          tax: 0,
          shipping: 0,
          total: subtotal,
          status: CheckoutStatus.DRAFT,
          couponCode: data.couponCode || null,
          expiresAt,
        },
        include: {
          cart: {
            include: {
              items: {
                include: {
                  variant: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (data.couponCode) {
        const couponResult = await this.couponVerifier.verifyAndCalculateDiscount(data.couponCode, subtotal);
        if (couponResult.valid) {
          await tx.checkout.update({
            where: { id: checkout.id },
            data: { discount: couponResult.discountAmount, couponCode: data.couponCode },
          });
        }
      }

      return this.calculateTotalsInternal(checkout.id, tx);
    });
  }

  async getCheckout(checkoutId: string) {
    const tenantId = this.getTenantId();
    const cacheKey = `tenant:${tenantId}:checkout:${checkoutId}`;

    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const checkout = await this.db.exec(async (tx) => {
      const found = await tx.checkout.findFirst({
        where: { id: checkoutId, tenantId },
        include: {
          cart: {
            include: {
              items: {
                include: {
                  variant: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!found) {
        throw new NotFoundException(`Checkout session with ID ${checkoutId} not found`);
      }

      if (found.expiresAt && found.expiresAt < new Date() && found.status !== CheckoutStatus.COMPLETED) {
        await tx.checkout.update({
          where: { id: checkoutId },
          data: { status: CheckoutStatus.EXPIRED },
        });
        throw new BadRequestException('Checkout session has expired');
      }

      return found;
    });

    await this.cache.set(cacheKey, checkout, 300);
    return checkout;
  }

  async updateCustomer(checkoutId: string, data: UpdateCustomerDto) {
    const tenantId = this.getTenantId();
    const updated = await this.db.exec(async (tx) => {
      const checkout = await this.getCheckoutEntity(checkoutId, tenantId, tx);
      return tx.checkout.update({
        where: { id: checkoutId },
        data: {
          customerId: data.customerId || checkout.customerId,
          customerInfo: {
            email: data.email,
            name: data.name,
            phone: data.phone || null,
          } as Prisma.InputJsonValue,
          status: CheckoutStatus.IN_PROGRESS,
        },
        include: { cart: { include: { items: { include: { variant: { include: { product: true } } } } } } },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:checkout:${checkoutId}`);
    return updated;
  }

  async updateAddresses(checkoutId: string, data: UpdateAddressesDto) {
    const tenantId = this.getTenantId();
    const updated = await this.db.exec(async (tx) => {
      await this.getCheckoutEntity(checkoutId, tenantId, tx);

      const billing = data.billingAddress || data.shippingAddress;

      await tx.checkout.update({
        where: { id: checkoutId },
        data: {
          shippingAddress: data.shippingAddress as unknown as Prisma.InputJsonValue,
          billingAddress: billing as unknown as Prisma.InputJsonValue,
          status: CheckoutStatus.IN_PROGRESS,
        },
      });

      return this.calculateTotalsInternal(checkoutId, tx);
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:checkout:${checkoutId}`);
    return updated;
  }

  async updateShippingMethod(checkoutId: string, data: UpdateShippingMethodDto) {
    const tenantId = this.getTenantId();
    const updated = await this.db.exec(async (tx) => {
      const checkout = await this.getCheckoutEntity(checkoutId, tenantId, tx);
      const itemsCount = checkout.cart?.items?.length || 1;

      const cost = await this.shippingCalculator.calculateShipping(
        data.shippingMethodCode,
        itemsCount,
        checkout.shippingAddress as Record<string, unknown>,
      );

      await tx.checkout.update({
        where: { id: checkoutId },
        data: {
          shippingMethod: {
            code: data.shippingMethodCode,
            price: cost,
          } as Prisma.InputJsonValue,
          shipping: cost,
          status: CheckoutStatus.IN_PROGRESS,
        },
      });

      return this.calculateTotalsInternal(checkoutId, tx);
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:checkout:${checkoutId}`);
    return updated;
  }

  async applyCoupon(checkoutId: string, data: ApplyCouponDto) {
    const tenantId = this.getTenantId();
    const updated = await this.db.exec(async (tx) => {
      const checkout = await this.getCheckoutEntity(checkoutId, tenantId, tx);

      const couponResult = await this.couponVerifier.verifyAndCalculateDiscount(data.couponCode, Number(checkout.subtotal));
      if (!couponResult.valid) {
        throw new BadRequestException(couponResult.message || `Invalid coupon code ${data.couponCode}`);
      }

      await tx.checkout.update({
        where: { id: checkoutId },
        data: {
          couponCode: data.couponCode,
          discount: couponResult.discountAmount,
        },
      });

      return this.calculateTotalsInternal(checkoutId, tx);
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:checkout:${checkoutId}`);
    return updated;
  }

  async removeCoupon(checkoutId: string) {
    const tenantId = this.getTenantId();
    const updated = await this.db.exec(async (tx) => {
      await this.getCheckoutEntity(checkoutId, tenantId, tx);

      await tx.checkout.update({
        where: { id: checkoutId },
        data: {
          couponCode: null,
          discount: 0,
        },
      });

      return this.calculateTotalsInternal(checkoutId, tx);
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:checkout:${checkoutId}`);
    return updated;
  }

  async validateCheckout(checkoutId: string) {
    const tenantId = this.getTenantId();
    const errors: string[] = [];

    const checkout = await this.db.exec(async (tx) => {
      return tx.checkout.findFirst({
        where: { id: checkoutId, tenantId },
        include: { cart: { include: { items: { include: { variant: { include: { product: true } } } } } } },
      });
    });

    if (!checkout) {
      return { valid: false, errors: ['Checkout session not found'] };
    }

    if (checkout.status === CheckoutStatus.COMPLETED || checkout.status === CheckoutStatus.EXPIRED || checkout.status === CheckoutStatus.CANCELLED) {
      errors.push(`Checkout status is ${checkout.status}`);
    }

    if (checkout.expiresAt && checkout.expiresAt < new Date()) {
      errors.push('Checkout session has expired');
    }

    if (!checkout.customerInfo) {
      errors.push('Customer information is missing');
    }

    if (!checkout.shippingAddress) {
      errors.push('Shipping address is missing');
    }

    if (!checkout.shippingMethod) {
      errors.push('Shipping method is missing');
    }

    if (!checkout.cart || !checkout.cart.items || checkout.cart.items.length === 0) {
      errors.push('Cart is empty or missing');
    } else {
      for (const item of checkout.cart.items) {
        if (!item.variant || !item.variant.product || !item.variant.product.isPublished || item.variant.product.deletedAt !== null) {
          errors.push(`Item variant ${item.variantId} is invalid, unpublished, or deleted`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async calculateTotals(checkoutId: string) {
    const tenantId = this.getTenantId();
    const updated = await this.db.exec(async (tx) => {
      return this.calculateTotalsInternal(checkoutId, tx);
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:checkout:${checkoutId}`);
    return updated;
  }

  private async calculateTotalsInternal(checkoutId: string, tx: Prisma.TransactionClient) {
    const tenantId = this.getTenantId();

    const checkout = await tx.checkout.findFirst({
      where: { id: checkoutId, tenantId },
      include: { cart: { include: { items: true } } },
    });

    if (!checkout) {
      throw new NotFoundException(`Checkout with ID ${checkoutId} not found`);
    }

    const items = checkout.cart?.items || [];
    const subtotal = items.reduce((acc, item) => acc + Number(item.subtotal), 0);

    const tax = await this.taxCalculator.calculateTax(subtotal, checkout.shippingAddress as Record<string, unknown>);
    const shipping = Number(checkout.shipping || 0);
    const discount = Number(checkout.discount || 0);

    const total = Math.max(0, subtotal - discount + tax + shipping);

    return tx.checkout.update({
      where: { id: checkoutId },
      data: {
        subtotal,
        tax,
        shipping,
        discount,
        total,
      },
      include: {
        cart: {
          include: {
            items: {
              include: {
                variant: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async confirmCheckout(checkoutId: string) {
    const tenantId = this.getTenantId();
    const validation = await this.validateCheckout(checkoutId);
    if (!validation.valid) {
      throw new BadRequestException(`Checkout validation failed: ${validation.errors.join(', ')}`);
    }

    const confirmed = await this.db.exec(async (tx) => {
      const checkout = await tx.checkout.update({
        where: { id: checkoutId },
        data: { status: CheckoutStatus.COMPLETED },
      });

      await tx.cart.update({
        where: { id: checkout.cartId },
        data: { status: CartStatus.CONVERTED },
      });

      return checkout;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:checkout:${checkoutId}`);
    return { success: true, checkoutId: confirmed.id, orderReady: true };
  }

  async expireCheckout(checkoutId: string) {
    const tenantId = this.getTenantId();
    const expired = await this.db.exec(async (tx) => {
      return tx.checkout.update({
        where: { id: checkoutId },
        data: { status: CheckoutStatus.EXPIRED },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:checkout:${checkoutId}`);
    return expired;
  }

  private async getCheckoutEntity(checkoutId: string, tenantId: string, tx: Prisma.TransactionClient) {
    const checkout = await tx.checkout.findFirst({
      where: { id: checkoutId, tenantId },
      include: { cart: { include: { items: true } } },
    });

    if (!checkout) {
      throw new NotFoundException(`Checkout session with ID ${checkoutId} not found`);
    }

    if (checkout.status === CheckoutStatus.COMPLETED || checkout.status === CheckoutStatus.EXPIRED || checkout.status === CheckoutStatus.CANCELLED) {
      throw new BadRequestException(`Cannot modify checkout with status ${checkout.status}`);
    }

    return checkout;
  }
}
