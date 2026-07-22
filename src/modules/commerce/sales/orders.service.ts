import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { OrderStatus, PaymentStatus, FulfillmentStatus, CheckoutStatus, CartStatus, Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { OrderQueryDto } from './dto/order-query.dto.js';
import { OrderNumberGenerator } from './services/order-number-generator.service.js';
import { OrderEventPublisher } from './events/order-event-publisher.service.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cache: CacheService,
    private readonly orderNumberGenerator: OrderNumberGenerator,
    private readonly eventPublisher: OrderEventPublisher,
  ) {}

  private getTenantId(): string {
    const ctx = requestContextStorage.getStore();
    return ctx?.tenantId || 'global';
  }

  private readonly validTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.DRAFT]: [OrderStatus.PENDING, OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED],
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PENDING_PAYMENT, OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
    [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.PACKED, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.PACKED, OrderStatus.FULFILLED, OrderStatus.CANCELLED],
    [OrderStatus.PACKED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.FULFILLED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
    [OrderStatus.AUTHORIZED]: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PARTIALLY_FULFILLED]: [OrderStatus.FULFILLED, OrderStatus.CANCELLED],
    [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
    [OrderStatus.REFUNDED]: [],
    [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.RETURNED],
    [OrderStatus.COMPLETED]: [OrderStatus.RETURNED],
    [OrderStatus.CANCELLED]: [],
  };

  async findAll(query?: OrderQueryDto) {
    return this.db.exec(async (tx) => {
      const where: Prisma.OrderWhereInput = {};
      if (query?.storeId) where.storeId = query.storeId;
      if (query?.customerId) where.customerId = query.customerId;
      if (query?.status && Object.values(OrderStatus).includes(query.status as OrderStatus)) {
        where.status = query.status as OrderStatus;
      }
      if (query?.search) {
        where.orderNumber = { contains: query.search, mode: 'insensitive' };
      }
      if (query?.startDate || query?.endDate) {
        where.createdAt = {};
        if (query?.startDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.startDate);
        if (query?.endDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(query.endDate);
      }

      const take = query?.take || query?.limit || 20;
      const skip = query?.skip || ((query?.page ? query.page - 1 : 0) * take) || 0;
      const orderBy: Prisma.OrderOrderByWithRelationInput = query?.sortBy ? { [query.sortBy]: query.sortOrder || 'desc' } : { createdAt: 'desc' };

      const [items, total] = await Promise.all([
        tx.order.findMany({
          where,
          include: {
            items: true,
            customer: true,
            timelines: { orderBy: { createdAt: 'desc' } },
            payments: true,
            shipments: true,
          },
          orderBy,
          take,
          skip,
        }),
        tx.order.count({ where }),
      ]);

      return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
    });
  }

  async findById(id: string) {
    const tenantId = this.getTenantId();
    const cacheKey = `tenant:${tenantId}:order:${id}`;

    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const order = await this.db.exec(async (tx) => {
      return tx.order.findFirst({
        where: { id, tenantId },
        include: {
          items: true,
          customer: true,
          timelines: { orderBy: { createdAt: 'desc' } },
          payments: true,
          shipments: true,
        },
      });
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    await this.cache.set(cacheKey, order, 300);
    return order;
  }

  async getOrder(id: string) {
    return this.findById(id);
  }

  async listOrders(query?: OrderQueryDto) {
    return this.findAll(query);
  }

  async trackOrder(orderNumber: string, phone: string) {
    const tenantId = this.getTenantId();
    const normalizedOrderNumber = orderNumber.trim();
    const normalizedPhone = phone.trim();

    const order = await this.db.exec((tx) => tx.order.findFirst({
      where: {
        tenantId,
        orderNumber: { equals: normalizedOrderNumber, mode: 'insensitive' },
        customer: { phone: normalizedPhone },
      },
      select: {
        orderNumber: true,
        status: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        currency: true,
        grandTotal: true,
        shippingAddress: true,
        createdAt: true,
        updatedAt: true,
        shipments: {
          select: {
            status: true,
            carrier: true,
            trackingNumber: true,
            shippedAt: true,
            deliveredAt: true,
          },
        },
      },
    }));

    if (!order) {
      throw new NotFoundException('Order not found for the supplied tracking details');
    }

    return order;
  }

  async create(data: {
    storeId: string;
    customerId: string;
    orderNumber: string;
    subtotal: number;
    taxTotal: number;
    shippingTotal: number;
    grandTotal: number;
    shippingAddress: Prisma.InputJsonValue;
    items: Array<{ variantId: string; priceUnit: number; quantity: number; taxRate: number }>;
    tenantId: string;
  }) {
    const ctx = requestContextStorage.getStore();
    const userId = ctx?.userId || null;

    return this.db.exec(async (tx) => {
      let storeId = data.storeId;
      const storeExists = await tx.store.findFirst({
        where: { id: storeId, tenantId: data.tenantId }
      });

      if (!storeExists) {
        const defaultStore = await tx.store.findFirst({
          where: { tenantId: data.tenantId }
        });
        if (!defaultStore) {
          const newStore = await tx.store.create({
            data: {
              tenantId: data.tenantId,
              name: 'Default Store',
              currency: 'IQD',
              languageDefault: 'ar',
            }
          });
          storeId = newStore.id;
        } else {
          storeId = defaultStore.id;
        }
      }

      let customerId = data.customerId;
      const customerExists = await tx.customer.findFirst({
        where: { id: customerId, tenantId: data.tenantId }
      });

      if (!customerExists) {
        const defaultCustomer = await tx.customer.findFirst({
          where: { tenantId: data.tenantId }
        });
        if (!defaultCustomer) {
          const newCustomer = await tx.customer.create({
            data: {
              tenantId: data.tenantId,
              name: 'Guest Customer',
              email: `guest-${Date.now()}@nexio.iq`,
              phone: '07700000000',
            }
          });
          customerId = newCustomer.id;
        } else {
          customerId = defaultCustomer.id;
        }
      }

      const itemsToCreate = [];
      for (const item of data.items) {
        let variantId = item.variantId;
        const variantExists = await tx.productVariant.findFirst({
          where: { id: variantId, product: { tenantId: data.tenantId } }
        });
        if (!variantExists) {
          const fallbackVariant = await tx.productVariant.findFirst({
            where: { product: { tenantId: data.tenantId } }
          });
          if (fallbackVariant) {
            variantId = fallbackVariant.id;
          } else {
            throw new BadRequestException('No product variant available for this tenant');
          }
        }
        itemsToCreate.push({
          tenantId: data.tenantId,
          variantId,
          priceUnit: item.priceUnit,
          quantity: item.quantity,
          taxRate: item.taxRate || 0,
        });
      }

      const order = await tx.order.create({
        data: {
          tenantId: data.tenantId,
          storeId,
          customerId,
          orderNumber: data.orderNumber,
          status: OrderStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.PENDING,
          fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
          subtotal: data.subtotal,
          taxTotal: data.taxTotal,
          shippingTotal: data.shippingTotal,
          grandTotal: data.grandTotal,
          shippingAddress: data.shippingAddress,
          items: {
            create: itemsToCreate,
          },
        },
        include: { items: true },
      });

      await tx.orderTimeline.create({
        data: {
          tenantId: data.tenantId,
          orderId: order.id,
          status: OrderStatus.PENDING_PAYMENT,
          note: 'Order created with status PENDING_PAYMENT',
          createdBy: userId,
        },
      });

      return order;
    });
  }

  async createOrderFromCheckout(checkoutId: string, notes?: string) {
    const tenantId = this.getTenantId();
    const ctx = requestContextStorage.getStore();
    const userId = ctx?.userId || null;

    const order = await this.db.exec(async (tx) => {
      const checkout = await tx.checkout.findFirst({
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

      if (!checkout) {
        throw new NotFoundException(`Checkout session with ID ${checkoutId} not found`);
      }

      if (checkout.expiresAt && checkout.expiresAt < new Date()) {
        throw new BadRequestException('Checkout session has expired');
      }

      if (checkout.status === CheckoutStatus.EXPIRED || checkout.status === CheckoutStatus.CANCELLED) {
        throw new BadRequestException(`Cannot create order from checkout with status ${checkout.status}`);
      }

      if (!checkout.cart || !checkout.cart.items || checkout.cart.items.length === 0) {
        throw new BadRequestException('Cannot create order from empty checkout cart');
      }

      // Resolve customer ID
      let customerId = checkout.customerId;
      if (!customerId) {
        const defaultCustomer = await tx.customer.findFirst({
          where: { tenantId },
        });
        if (defaultCustomer) {
          customerId = defaultCustomer.id;
        } else {
          const newCustomer = await tx.customer.create({
            data: {
              tenantId,
              name: (checkout.customerInfo as any)?.name || 'Guest Customer',
              email: (checkout.customerInfo as any)?.email || `guest-${Date.now()}@nexio.iq`,
            },
          });
          customerId = newCustomer.id;
        }
      }

      // Verify inventory & snapshot items
      const itemsToCreate = [];
      for (const item of checkout.cart.items) {
        const variant = item.variant;
        const product = variant?.product;
        if (!product || !product.isPublished || product.deletedAt !== null) {
          throw new BadRequestException(`Product variant ${item.variantId} is invalid, unpublished, or deleted`);
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
            throw new BadRequestException(`Insufficient inventory for variant ${item.variantId}`);
          }
        }

        // Snapshot product/variant fields
        itemsToCreate.push({
          tenantId,
          productId: product.id,
          variantId: item.variantId,
          sku: variant.sku,
          productName: (product.titleTranslations as any)?.en || 'Product',
          variantName: variant.sku,
          priceUnit: Number(item.unitPrice),
          quantity: item.quantity,
          taxRate: 15,
          subtotal: Number(item.subtotal),
          metadata: item.metadata ? (item.metadata as Prisma.InputJsonValue) : undefined,
        });
      }

      const orderNumber = this.orderNumberGenerator.generateOrderNumber();

      const createdOrder = await tx.order.create({
        data: {
          tenantId,
          storeId: checkout.storeId,
          checkoutId: checkout.id,
          cartId: checkout.cartId,
          customerId,
          orderNumber,
          currency: checkout.currency || 'USD',
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PENDING,
          fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
          subtotal: checkout.subtotal,
          discount: checkout.discount,
          taxTotal: checkout.tax,
          shippingTotal: checkout.shipping,
          grandTotal: checkout.total,
          shippingAddress: checkout.shippingAddress || {},
          billingAddress: checkout.billingAddress || checkout.shippingAddress || {},
          notes,
          items: {
            create: itemsToCreate,
          },
        },
        include: { items: true },
      });

      // Update checkout and cart status
      await tx.checkout.update({
        where: { id: checkout.id },
        data: { status: CheckoutStatus.COMPLETED },
      });

      await tx.cart.update({
        where: { id: checkout.cartId },
        data: { status: CartStatus.CONVERTED },
      });

      // Record OrderTimeline initial entry
      await tx.orderTimeline.create({
        data: {
          tenantId,
          orderId: createdOrder.id,
          status: OrderStatus.CONFIRMED,
          note: 'Order created from checkout session',
          createdBy: userId,
        },
      });

      return createdOrder;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${order.id}`);

    await this.eventPublisher.publish({
      eventType: 'OrderCreated',
      tenantId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      payload: { grandTotal: Number(order.grandTotal) },
      occurredAt: new Date(),
    });

    return order;
  }

  async updateStatus(id: string, newStatus: OrderStatus, warehouseId?: string) {
    return this.updateOrderStatus(id, newStatus, warehouseId);
  }

  async updateOrderStatus(id: string, newStatus: OrderStatus, warehouseId?: string) {
    const tenantId = this.getTenantId();
    const ctx = requestContextStorage.getStore();
    const userId = ctx?.userId || null;

    const updatedOrder = await this.db.exec(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, tenantId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      const allowedNextStates = this.validTransitions[order.status] || [];
      if (!allowedNextStates.includes(newStatus)) {
        throw new BadRequestException(
          `Invalid order status transition from '${order.status}' to '${newStatus}'. Allowed transitions: [${allowedNextStates.join(', ')}]`,
        );
      }

      if (
        (order.status === OrderStatus.PAID && newStatus === OrderStatus.PROCESSING) ||
        newStatus === OrderStatus.FULFILLED
      ) {
        if (!warehouseId) {
          const wh = await tx.warehouse.findFirst({ where: { isActive: true, tenantId } });
          if (wh) warehouseId = wh.id;
        }

        if (warehouseId) {
          for (const item of order.items) {
            const stock: Array<{ quantity_physical: number; quantity_reserved: number }> = await tx.$queryRaw`
              SELECT "quantity_physical", "quantity_reserved"
              FROM stock_levels
              WHERE tenant_id = ${tenantId}::uuid AND variant_id = ${item.variantId}::uuid AND warehouse_id = ${warehouseId}::uuid
              FOR UPDATE
            `;

            if (stock && stock.length > 0) {
              const currentPhysical = stock[0].quantity_physical || 0;
              const currentReserved = stock[0].quantity_reserved || 0;
              const newPhysical = Math.max(0, currentPhysical - item.quantity);
              const newReserved = Math.max(0, currentReserved - item.quantity);

              await tx.stockLevel.update({
                where: {
                  tenantId_warehouseId_variantId: {
                    tenantId,
                    warehouseId,
                    variantId: item.variantId,
                  },
                },
                data: {
                  quantityPhysical: newPhysical,
                  quantityReserved: newReserved,
                },
              });

              await tx.stockMovement.create({
                data: {
                  tenantId,
                  warehouseId,
                  variantId: item.variantId,
                  quantityChange: -item.quantity,
                  type: 'SALE',
                  reason: 'ORDER_PROCESSING',
                  referenceId: order.id,
                  createdBy: userId,
                },
              });
            }
          }
        }
      }

      const updated = await tx.order.update({
        where: { id },
        data: { status: newStatus },
        include: { items: true },
      });

      await tx.orderTimeline.create({
        data: {
          tenantId,
          orderId: order.id,
          status: newStatus,
          note: `Order status updated to ${newStatus}`,
          createdBy: userId,
        },
      });

      return updated;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${id}`);
    return updatedOrder;
  }

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus) {
    const tenantId = this.getTenantId();
    const ctx = requestContextStorage.getStore();
    const userId = ctx?.userId || null;

    const updated = await this.db.exec(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, tenantId },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { paymentStatus },
        include: { items: true },
      });

      await tx.orderTimeline.create({
        data: {
          tenantId,
          orderId: id,
          status: order.status,
          note: `Payment status updated to ${paymentStatus}`,
          createdBy: userId,
        },
      });

      return updatedOrder;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${id}`);

    await this.eventPublisher.publish({
      eventType: 'PaymentStatusUpdated',
      tenantId,
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      payload: { paymentStatus },
      occurredAt: new Date(),
    });

    return updated;
  }

  async updateFulfillmentStatus(id: string, fulfillmentStatus: FulfillmentStatus) {
    const tenantId = this.getTenantId();
    const ctx = requestContextStorage.getStore();
    const userId = ctx?.userId || null;

    const updated = await this.db.exec(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, tenantId },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { fulfillmentStatus },
        include: { items: true },
      });

      await tx.orderTimeline.create({
        data: {
          tenantId,
          orderId: id,
          status: order.status,
          note: `Fulfillment status updated to ${fulfillmentStatus}`,
          createdBy: userId,
        },
      });

      return updatedOrder;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${id}`);

    await this.eventPublisher.publish({
      eventType: 'FulfillmentStatusUpdated',
      tenantId,
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      payload: { fulfillmentStatus },
      occurredAt: new Date(),
    });

    return updated;
  }

  async cancelOrder(id: string, reason?: string) {
    const tenantId = this.getTenantId();
    const ctx = requestContextStorage.getStore();
    const userId = ctx?.userId || null;

    const cancelledOrder = await this.db.exec(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, tenantId },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      if (
        order.status === OrderStatus.SHIPPED ||
        order.status === OrderStatus.DELIVERED ||
        order.status === OrderStatus.CANCELLED ||
        order.status === OrderStatus.REFUNDED
      ) {
        throw new BadRequestException(`Cannot cancel order in status ${order.status}`);
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
          notes: reason ? `${order.notes || ''}\nCancellation reason: ${reason}`.trim() : order.notes,
        },
        include: { items: true },
      });

      await tx.orderTimeline.create({
        data: {
          tenantId,
          orderId: id,
          status: OrderStatus.CANCELLED,
          note: `Order cancelled. ${reason ? 'Reason: ' + reason : ''}`,
          createdBy: userId,
        },
      });

      return updated;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${id}`);

    await this.eventPublisher.publish({
      eventType: 'OrderCancelled',
      tenantId,
      orderId: cancelledOrder.id,
      orderNumber: cancelledOrder.orderNumber,
      payload: { reason: reason || 'N/A' },
      occurredAt: new Date(),
    });

    return cancelledOrder;
  }

  async addInternalNote(id: string, note: string) {
    const tenantId = this.getTenantId();
    const ctx = requestContextStorage.getStore();
    const userId = ctx?.userId || null;

    const updated = await this.db.exec(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, tenantId },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      const newNotes = order.notes ? `${order.notes}\n${note}` : note;

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { notes: newNotes },
        include: { items: true },
      });

      await tx.orderTimeline.create({
        data: {
          tenantId,
          orderId: id,
          status: order.status,
          note: `Note added: ${note}`,
          createdBy: userId,
        },
      });

      return updatedOrder;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${id}`);
    return updated;
  }

  async validateOrder(id: string) {
    const tenantId = this.getTenantId();
    const order = await this.db.exec(async (tx) => {
      return tx.order.findFirst({
        where: { id, tenantId },
        include: { items: true },
      });
    });

    if (!order) {
      return { valid: false, errors: ['Order not found'] };
    }

    const errors: string[] = [];
    if (order.status === OrderStatus.CANCELLED) {
      errors.push('Order is cancelled');
    }
    if (!order.items || order.items.length === 0) {
      errors.push('Order has no items');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
