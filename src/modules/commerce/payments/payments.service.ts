import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { PaymentQueryDto } from './dto/payment-query.dto.js';
import { WebhookPayloadDto } from './dto/webhook-payload.dto.js';
import { WebhookSecurityService } from './security/webhook-security.service.js';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto.js';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { PaymentGatewayStrategy } from './strategies/payment-gateway-strategy.interface.js';
import { PaymentEventPublisher } from './events/payment-event-publisher.service.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cache: CacheService,
    private readonly webhookSecurityService: WebhookSecurityService,
    @Inject('PAYMENT_STRATEGY_REGISTRY') private readonly strategyRegistry: Map<string, PaymentGatewayStrategy>,
    private readonly eventPublisher: PaymentEventPublisher,
  ) {}

  private getTenantId(): string {
    const ctx = requestContextStorage.getStore();
    return ctx?.tenantId || 'global';
  }

  private resolveStrategy(provider: string): PaymentGatewayStrategy {
    const key = provider.toLowerCase();
    const strategy = this.strategyRegistry.get(key);
    if (!strategy) {
      const fallback = this.strategyRegistry.get('mock');
      if (fallback) return fallback;
      throw new BadRequestException(`Payment provider strategy '${provider}' not supported`);
    }
    return strategy;
  }

  async findAll(query?: PaymentQueryDto) {
    const tenantId = this.getTenantId();
    return this.db.exec(async (tx) => {
      const where: Prisma.PaymentWhereInput = { tenantId };
      if (query?.provider) {
        where.provider = query.provider;
      }
      if (query?.orderId) {
        where.orderId = query.orderId;
      }
      if (query?.startDate || query?.endDate) {
        where.createdAt = {};
        if (query?.startDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.startDate);
        if (query?.endDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(query.endDate);
      }

      const take = query?.take || 20;
      const skip = query?.skip || 0;
      const orderBy: Prisma.PaymentOrderByWithRelationInput = query?.sortBy ? { [query.sortBy]: query.sortOrder || 'desc' } : { createdAt: 'desc' };

      const [items, total] = await Promise.all([
        tx.payment.findMany({
          where,
          include: {
            order: true,
          },
          orderBy,
          take,
          skip,
        }),
        tx.payment.count({ where }),
      ]);

      return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
    });
  }

  async listPayments(query?: PaymentQueryDto) {
    return this.findAll(query);
  }

  async getPayment(id: string) {
    const tenantId = this.getTenantId();
    const cacheKey = `tenant:${tenantId}:payment:${id}`;

    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const payment = await this.db.exec(async (tx) => {
      return tx.payment.findFirst({
        where: { id, tenantId },
        include: { order: true },
      });
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    await this.cache.set(cacheKey, payment, 300);
    return payment;
  }

  async createPaymentIntent(data: CreatePaymentIntentDto) {
    const tenantId = this.getTenantId();
    const strategy = this.resolveStrategy(data.provider);

    const payment = await this.db.exec(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: data.orderId, tenantId },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${data.orderId} not found`);
      }

      // Idempotency: return active pending payment if exists
      const existingPayment = await tx.payment.findFirst({
        where: { tenantId, orderId: data.orderId, provider: strategy.providerName, status: 'PENDING' },
      });
      if (existingPayment) {
        return existingPayment;
      }

      const res = await strategy.createPayment(data.amount, data.currency || order.currency || 'USD', order.id, data.metadata);

      return tx.payment.create({
        data: {
          tenantId,
          storeId: order.storeId,
          orderId: data.orderId,
          provider: strategy.providerName,
          paymentReference: res.paymentReference,
          externalTransactionId: res.externalTransactionId || null,
          transactionId: res.externalTransactionId || null,
          amount: data.amount,
          currency: data.currency || order.currency || 'USD',
          status: 'PENDING',
          retryCount: 0,
          metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : undefined,
        },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:payment:${payment.id}`);

    await this.eventPublisher.publish({
      eventType: 'PaymentCreated',
      tenantId,
      paymentId: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
      amount: Number(payment.amount),
      currency: payment.currency,
      occurredAt: new Date(),
    });

    return payment;
  }

  async createPayment(data: {
    orderId: string;
    provider: string;
    transactionId: string;
    amount: number;
    currency?: string;
    status?: string;
  }) {
    return this.createPaymentIntent({
      orderId: data.orderId,
      provider: data.provider,
      amount: data.amount,
      currency: data.currency,
    });
  }

  async initiatePayment(paymentId: string) {
    const tenantId = this.getTenantId();
    const updated = await this.db.exec(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId },
      });
      if (!payment) {
        throw new NotFoundException(`Payment with ID ${paymentId} not found`);
      }

      return tx.payment.update({
        where: { id: paymentId },
        data: { status: 'PENDING' },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:payment:${paymentId}`);

    await this.eventPublisher.publish({
      eventType: 'PaymentInitiated',
      tenantId,
      paymentId: updated.id,
      orderId: updated.orderId,
      provider: updated.provider,
      amount: Number(updated.amount),
      currency: updated.currency,
      occurredAt: new Date(),
    });

    return updated;
  }

  async confirmPayment(paymentId: string, dto?: ConfirmPaymentDto) {
    const tenantId = this.getTenantId();

    const result = await this.db.exec(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId },
      });
      if (!payment) {
        throw new NotFoundException(`Payment with ID ${paymentId} not found`);
      }

      const strategy = this.resolveStrategy(payment.provider);
      const extTxId = dto?.externalTransactionId || payment.externalTransactionId || undefined;
      const verifyRes = await strategy.verifyPayment(payment.paymentReference || payment.id, extTxId);

      const status = verifyRes.success ? 'PAID' : 'FAILED';

      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status,
          externalTransactionId: verifyRes.externalTransactionId || payment.externalTransactionId,
          transactionId: verifyRes.externalTransactionId || payment.transactionId,
          failureReason: verifyRes.failureReason || null,
        },
      });

      if (verifyRes.success) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID', paymentStatus: 'PAID' },
        });
      } else {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: 'FAILED' },
        });
      }

      return updatedPayment;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:payment:${paymentId}`);

    await this.eventPublisher.publish({
      eventType: result.status === 'PAID' ? 'PaymentSucceeded' : 'PaymentFailed',
      tenantId,
      paymentId: result.id,
      orderId: result.orderId,
      provider: result.provider,
      amount: Number(result.amount),
      currency: result.currency,
      occurredAt: new Date(),
    });

    return result;
  }

  async cancelPayment(paymentId: string) {
    const tenantId = this.getTenantId();
    const updated = await this.db.exec(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId },
      });
      if (!payment) {
        throw new NotFoundException(`Payment with ID ${paymentId} not found`);
      }

      const strategy = this.resolveStrategy(payment.provider);
      if (payment.paymentReference) {
        await strategy.cancelPayment(payment.paymentReference);
      }

      return tx.payment.update({
        where: { id: paymentId },
        data: { status: 'CANCELLED' },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:payment:${paymentId}`);

    await this.eventPublisher.publish({
      eventType: 'PaymentCancelled',
      tenantId,
      paymentId: updated.id,
      orderId: updated.orderId,
      provider: updated.provider,
      amount: Number(updated.amount),
      currency: updated.currency,
      occurredAt: new Date(),
    });

    return updated;
  }

  async refundPayment(paymentId: string, dto?: RefundPaymentDto) {
    const tenantId = this.getTenantId();
    const payment = await this.db.exec(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId },
      });
      if (!payment) {
        throw new NotFoundException(`Payment with ID ${paymentId} not found`);
      }

      if (payment.status === 'REFUNDED') {
        return {
          alreadyComplete: true,
          record: payment,
          metadata: {} as Record<string, unknown>,
          alreadyRefunded: Number(payment.amount),
          refundAmount: 0,
        };
      }

      if (!['PAID', 'AUTHORIZED', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
        throw new BadRequestException(`Payment in status ${payment.status} cannot be refunded`);
      }

      const metadata = payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata)
        ? payment.metadata as Record<string, unknown>
        : {};
      const alreadyRefunded = Number(metadata.refundedAmount || 0);
      const refundAmount = dto?.amount ?? (Number(payment.amount) - alreadyRefunded);
      if (refundAmount <= 0 || alreadyRefunded + refundAmount > Number(payment.amount)) {
        throw new BadRequestException('Refund amount exceeds the remaining refundable balance');
      }

      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, tenantId, status: payment.status },
        data: { status: 'REFUNDING' },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('A refund is already being processed for this payment');
      }

      return { alreadyComplete: false, record: payment, metadata, alreadyRefunded, refundAmount };
    });

    if (payment.alreadyComplete) return payment.record;

    const strategy = this.resolveStrategy(payment.record.provider);
    try {
      if (payment.record.paymentReference) {
        await strategy.refundPayment(payment.record.paymentReference, payment.refundAmount, dto?.reason);
      }
    } catch (error) {
      await this.db.exec((tx) => tx.payment.update({
        where: { id: paymentId },
        data: {
          status: payment.record.status,
          failureReason: error instanceof Error ? error.message : 'Refund provider call failed',
        },
      }));
      throw error;
    }

    const totalRefunded = payment.alreadyRefunded + payment.refundAmount;
    const isFullRefund = totalRefunded >= Number(payment.record.amount);
    const updated = await this.db.exec(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          failureReason: null,
          metadata: {
            ...payment.metadata,
            refundedAmount: totalRefunded,
            lastRefundReason: dto?.reason || null,
          } as Prisma.InputJsonValue,
        },
      });

      if (isFullRefund) {
        await tx.order.update({
          where: { id: payment.record.orderId },
          data: { paymentStatus: 'REFUNDED', status: 'REFUNDED' },
        });
      }

      return updatedPayment;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:payment:${paymentId}`);

    await this.eventPublisher.publish({
      eventType: 'PaymentRefunded',
      tenantId,
      paymentId: updated.id,
      orderId: updated.orderId,
      provider: updated.provider,
      amount: Number(updated.amount),
      currency: updated.currency,
      occurredAt: new Date(),
    });

    return updated;
  }

  async retryPayment(paymentId: string) {
    const tenantId = this.getTenantId();
    const updated = await this.db.exec(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId },
      });
      if (!payment) {
        throw new NotFoundException(`Payment with ID ${paymentId} not found`);
      }

      if (payment.retryCount >= 3) {
        throw new BadRequestException(`Maximum retry limit (3) reached for payment ${paymentId}`);
      }

      return tx.payment.update({
        where: { id: paymentId },
        data: {
          retryCount: payment.retryCount + 1,
          status: 'PENDING',
          failureReason: null,
        },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:payment:${paymentId}`);

    await this.eventPublisher.publish({
      eventType: 'PaymentInitiated',
      tenantId,
      paymentId: updated.id,
      orderId: updated.orderId,
      provider: updated.provider,
      amount: Number(updated.amount),
      currency: updated.currency,
      occurredAt: new Date(),
    });

    return updated;
  }

  async validatePayment(id: string) {
    const tenantId = this.getTenantId();
    const payment = await this.db.exec(async (tx) => {
      return tx.payment.findFirst({
        where: { id, tenantId },
      });
    });

    if (!payment) {
      return { valid: false, errors: ['Payment not found'] };
    }

    const errors: string[] = [];
    if (payment.status === 'FAILED') {
      errors.push(`Payment failed: ${payment.failureReason || 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async processWebhook(
    provider: string,
    payload: WebhookPayloadDto | Record<string, unknown>,
    signature?: string,
    timestampHeader?: string,
    rawBody?: string,
  ) {
    const ctx = requestContextStorage.getStore();
    const tenantId = ctx?.tenantId || 'global';

    const payloadRec = payload as Record<string, unknown>;
    const rawString = rawBody || JSON.stringify(payload);

    const verification = await this.webhookSecurityService.verifyAndProtect(
      provider,
      rawString,
      signature,
      timestampHeader,
      payloadRec,
    );

    const eventId = verification.eventId;
    const normalizedProvider = verification.provider;

    return this.db.exec(async (tx) => {
      const existing = await tx.paymentWebhookEvent.findFirst({
        where: { tenantId, provider: normalizedProvider, eventId },
      });

      if (existing) {
        return { message: 'Duplicate webhook event ignored (replay attack prevented)', eventId };
      }

      const event = await tx.paymentWebhookEvent.create({
        data: {
          tenantId,
          provider: normalizedProvider,
          eventId,
          payload: payload as Prisma.InputJsonValue,
          processed: true,
        },
      });

      const orderId = payloadRec.orderId ? String(payloadRec.orderId) : (payloadRec.order_id ? String(payloadRec.order_id) : undefined);
      const status = payloadRec.status ? String(payloadRec.status).toLowerCase() : '';

      if (orderId && (status === 'paid' || status === 'captured' || status === 'success')) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'PAID', paymentStatus: 'PAID' },
        });
      }

      return { success: true, eventId: event.eventId };
    });
  }
}
