import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { CartStatus, Prisma } from '@prisma/client';
import { CreateCartDto } from './dto/create-cart.dto.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';

@Injectable()
export class CartService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cache: CacheService,
  ) {}

  private getTenantId(): string {
    const ctx = requestContextStorage.getStore();
    return ctx?.tenantId || 'global';
  }

  async createCart(data: CreateCartDto) {
    const tenantId = this.getTenantId();

    return this.db.exec(async (tx) => {
      let store = null;
      if (data.storeId) {
        store = await tx.store.findFirst({
          where: { id: data.storeId, tenantId },
        });
        if (!store) {
          throw new NotFoundException(`Store with ID ${data.storeId} not found`);
        }
      } else {
        store = await tx.store.findFirst({ where: { tenantId } });
        if (!store) {
          store = await tx.store.create({
            data: {
              tenantId,
              name: 'Default Store',
              currency: 'IQD',
              languageDefault: 'ar',
            },
          });
        }
      }

      // One active cart per customer per store
      if (data.customerId) {
        const existingCustomerCart = await tx.cart.findFirst({
          where: {
            tenantId,
            storeId: store.id,
            customerId: data.customerId,
            status: CartStatus.ACTIVE,
          },
          include: { items: { include: { variant: { include: { product: true } } } } },
        });
        if (existingCustomerCart) {
          return existingCustomerCart;
        }
      }

      // One active cart per session per store for guest users
      if (data.sessionId && !data.customerId) {
        const existingSessionCart = await tx.cart.findFirst({
          where: {
            tenantId,
            storeId: store.id,
            sessionId: data.sessionId,
            status: CartStatus.ACTIVE,
          },
          include: { items: { include: { variant: { include: { product: true } } } } },
        });
        if (existingSessionCart) {
          return existingSessionCart;
        }
      }

      return tx.cart.create({
        data: {
          tenantId,
          storeId: store.id,
          customerId: data.customerId,
          sessionId: data.sessionId,
          currency: data.currency || store.currency || 'USD',
          status: CartStatus.ACTIVE,
          subtotal: 0,
          discount: 0,
          tax: 0,
          shipping: 0,
          total: 0,
        },
        include: { items: { include: { variant: { include: { product: true } } } } },
      });
    });
  }

  async getCart(cartId: string) {
    const tenantId = this.getTenantId();
    const cacheKey = `tenant:${tenantId}:cart:${cartId}`;

    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const cart = await this.db.exec(async (tx) => {
      return tx.cart.findFirst({
        where: { id: cartId, tenantId, status: CartStatus.ACTIVE },
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
    });

    if (!cart) {
      throw new NotFoundException(`Active Cart with ID ${cartId} not found`);
    }

    // Filter out items with unpublished or deleted products
    cart.items = cart.items.filter(
      (item) => item.variant && item.variant.product && item.variant.product.isPublished && !item.variant.product.deletedAt,
    );

    await this.cache.set(cacheKey, cart, 300);
    return cart;
  }

  async addItem(cartId: string, data: AddCartItemDto) {
    if (data.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    const tenantId = this.getTenantId();

    const updatedCart = await this.db.exec(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: { id: cartId, tenantId, status: CartStatus.ACTIVE },
      });

      if (!cart) {
        throw new NotFoundException(`Active Cart with ID ${cartId} not found`);
      }

      const variant = await tx.productVariant.findFirst({
        where: { id: data.variantId, tenantId },
        include: { product: true },
      });

      if (!variant) {
        throw new NotFoundException(`Product Variant with ID ${data.variantId} not found`);
      }

      const product = variant.product;
      if (!product || product.tenantId !== tenantId) {
        throw new BadRequestException('Product variant belongs to another tenant');
      }

      if (product.storeId !== cart.storeId) {
        throw new BadRequestException('Product variant belongs to a different store');
      }

      if (product.deletedAt !== null) {
        throw new BadRequestException('Cannot add deleted product to cart');
      }

      if (!product.isPublished) {
        throw new BadRequestException('Cannot add unpublished product to cart');
      }

      const existingItem = await tx.cartItem.findFirst({
        where: { tenantId, cartId, variantId: data.variantId },
      });

      const newQuantity = existingItem ? existingItem.quantity + data.quantity : data.quantity;

      await this.validateInventory(data.variantId, newQuantity, tx);

          const unitPrice = Number(variant.priceOverride ?? variant.price);
      const subtotal = unitPrice * newQuantity;

      if (existingItem) {
        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: newQuantity,
            unitPrice,
            subtotal,
            metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : (existingItem.metadata ? (existingItem.metadata as Prisma.InputJsonValue) : undefined),
          },
        });
      } else {
        await tx.cartItem.create({
          data: {
            tenantId,
            cartId,
            productId: product.id,
            variantId: data.variantId,
            quantity: data.quantity,
            unitPrice,
            subtotal: unitPrice * data.quantity,
            metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : undefined,
          },
        });
      }

      return this.calculateTotalsInternal(cartId, tx);
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:cart:${cartId}`);
    return updatedCart;
  }

  async updateItem(cartId: string, itemId: string, data: UpdateCartItemDto) {
    if (data.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    const tenantId = this.getTenantId();

    const updatedCart = await this.db.exec(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: { id: cartId, tenantId, status: CartStatus.ACTIVE },
      });
      if (!cart) {
        throw new NotFoundException(`Active Cart with ID ${cartId} not found`);
      }

      const item = await tx.cartItem.findFirst({
        where: { id: itemId, cartId, tenantId },
        include: { variant: { include: { product: true } } },
      });
      if (!item) {
        throw new NotFoundException(`Cart item with ID ${itemId} not found in cart`);
      }

      await this.validateInventory(item.variantId, data.quantity, tx);

      const unitPrice = Number(item.unitPrice);
      const subtotal = unitPrice * data.quantity;

      await tx.cartItem.update({
        where: { id: itemId },
        data: {
          quantity: data.quantity,
          subtotal,
        },
      });

      return this.calculateTotalsInternal(cartId, tx);
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:cart:${cartId}`);
    return updatedCart;
  }

  async removeItem(cartId: string, itemId: string) {
    const tenantId = this.getTenantId();

    const updatedCart = await this.db.exec(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: { id: cartId, tenantId, status: CartStatus.ACTIVE },
      });
      if (!cart) {
        throw new NotFoundException(`Active Cart with ID ${cartId} not found`);
      }

      const item = await tx.cartItem.findFirst({
        where: { id: itemId, cartId, tenantId },
      });
      if (!item) {
        throw new NotFoundException(`Cart item with ID ${itemId} not found in cart`);
      }

      await tx.cartItem.delete({
        where: { id: itemId },
      });

      return this.calculateTotalsInternal(cartId, tx);
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:cart:${cartId}`);
    return updatedCart;
  }

  async clearCart(cartId: string) {
    const tenantId = this.getTenantId();

    const updatedCart = await this.db.exec(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: { id: cartId, tenantId, status: CartStatus.ACTIVE },
      });
      if (!cart) {
        throw new NotFoundException(`Active Cart with ID ${cartId} not found`);
      }

      await tx.cartItem.deleteMany({
        where: { cartId, tenantId },
      });

      return tx.cart.update({
        where: { id: cartId },
        data: {
          subtotal: 0,
          discount: 0,
          tax: 0,
          shipping: 0,
          total: 0,
        },
        include: { items: { include: { variant: { include: { product: true } } } } },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:cart:${cartId}`);
    return updatedCart;
  }

  async mergeGuestCart(guestSessionIdOrCartId: string, customerId: string, storeId: string) {
    const tenantId = this.getTenantId();

    const customerCart = await this.db.exec(async (tx) => {
      const guestCart = await tx.cart.findFirst({
        where: {
          tenantId,
          storeId,
          OR: [{ id: guestSessionIdOrCartId }, { sessionId: guestSessionIdOrCartId }],
          status: CartStatus.ACTIVE,
        },
        include: { items: { include: { variant: { include: { product: true } } } } },
      });

      let targetCart = await tx.cart.findFirst({
        where: { tenantId, storeId, customerId, status: CartStatus.ACTIVE },
        include: { items: true },
      });

      if (!targetCart) {
        targetCart = await tx.cart.create({
          data: {
            tenantId,
            storeId,
            customerId,
            currency: 'USD',
            status: CartStatus.ACTIVE,
            subtotal: 0,
            discount: 0,
            tax: 0,
            shipping: 0,
            total: 0,
          },
          include: { items: true },
        });
      }

      if (guestCart && guestCart.id !== targetCart.id) {
        for (const guestItem of guestCart.items) {
          const existingCustomerItem = targetCart.items.find((i) => i.variantId === guestItem.variantId);
          const combinedQty = existingCustomerItem ? existingCustomerItem.quantity + guestItem.quantity : guestItem.quantity;

          await this.validateInventory(guestItem.variantId, combinedQty, tx);

          const unitPrice = guestItem.variant
            ? Number(guestItem.variant.priceOverride ?? guestItem.variant.price)
            : Number(guestItem.unitPrice);

          if (existingCustomerItem) {
            await tx.cartItem.update({
              where: { id: existingCustomerItem.id },
              data: {
                quantity: combinedQty,
                unitPrice,
                subtotal: unitPrice * combinedQty,
              },
            });
            await tx.cartItem.delete({ where: { id: guestItem.id } });
          } else {
            await tx.cartItem.update({
              where: { id: guestItem.id },
              data: { 
                cartId: targetCart.id,
                unitPrice,
                subtotal: unitPrice * guestItem.quantity,
              },
            });
          }
        }

        await tx.cart.update({
          where: { id: guestCart.id },
          data: { status: CartStatus.MERGED },
        });
      }

      return this.calculateTotalsInternal(targetCart.id, tx);
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:cart:${guestSessionIdOrCartId}`);
    await this.cache.invalidatePattern(`tenant:${tenantId}:cart:${customerCart.id}`);
    return customerCart;
  }

  async calculateTotals(cartId: string) {
    const tenantId = this.getTenantId();
    const updatedCart = await this.db.exec(async (tx) => {
      return this.calculateTotalsInternal(cartId, tx);
    });
    await this.cache.invalidatePattern(`tenant:${tenantId}:cart:${cartId}`);
    return updatedCart;
  }

  private async calculateTotalsInternal(cartId: string, tx: Prisma.TransactionClient) {
    const tenantId = this.getTenantId();

    const items = await tx.cartItem.findMany({
      where: { cartId, tenantId },
    });

    const subtotal = items.reduce((acc, item) => acc + Number(item.subtotal), 0);
    const tax = subtotal * 0.15; // 15% standard tax calculation
    const shipping = items.length > 0 ? 10 : 0;
    const discount = 0;
    const total = subtotal - discount + tax + shipping;

    return tx.cart.update({
      where: { id: cartId },
      data: {
        subtotal,
        discount,
        tax,
        shipping,
        total,
      },
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
  }

  async validateInventory(variantId: string, requestedQuantity: number, tx?: Prisma.TransactionClient) {
    const tenantId = this.getTenantId();
    const prisma = tx || this.db;

    const stockLevels = await (prisma as any).stockLevel.findMany({
      where: { variantId, tenantId },
    });

    if (stockLevels && stockLevels.length > 0) {
      const availableStock = stockLevels.reduce(
        (acc: number, stock: any) => acc + (stock.quantityPhysical - stock.quantityReserved),
        0,
      );

      if (availableStock < requestedQuantity) {
        throw new BadRequestException(`Insufficient stock available for variant (Requested: ${requestedQuantity}, Available: ${availableStock})`);
      }
      return { available: true, stockRemaining: availableStock };
    }

    return { available: true, stockRemaining: 9999 };
  }

  async expireCart(cartId: string) {
    const tenantId = this.getTenantId();
    const cart = await this.db.exec(async (tx) => {
      const existing = await tx.cart.findFirst({
        where: { id: cartId, tenantId },
      });
      if (!existing) {
        throw new NotFoundException(`Cart with ID ${cartId} not found`);
      }
      return tx.cart.update({
        where: { id: cartId },
        data: { status: CartStatus.EXPIRED },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:cart:${cartId}`);
    return cart;
  }
}
