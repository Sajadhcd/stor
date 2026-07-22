import { Controller, Get, Post, Body, Param, Query, Headers, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service.js';
import { PaymentQueryDto } from './dto/payment-query.dto.js';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto.js';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { WebhookPayloadDto } from './dto/webhook-payload.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../security/decorators/permissions.decorator.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({ summary: 'List payments with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of payments' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('payments:read')
  @Get()
  async listPayments(@Query() query: PaymentQueryDto) {
    return this.paymentsService.listPayments(query);
  }

  @ApiOperation({ summary: 'Create a new payment intent' })
  @ApiResponse({ status: 201, description: 'Payment intent created successfully' })
  @Post('intent')
  async createPaymentIntent(@Body() body: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(body);
  }

  @ApiOperation({ summary: 'Get payment details by ID' })
  @ApiResponse({ status: 200, description: 'Payment details retrieved' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('payments:read')
  @Get(':id')
  async getPayment(@Param('id') id: string) {
    return this.paymentsService.getPayment(id);
  }

  @ApiOperation({ summary: 'Initiate payment processing' })
  @ApiResponse({ status: 200, description: 'Payment processing initiated' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('payments:update')
  @Post(':id/initiate')
  async initiatePayment(@Param('id') id: string) {
    return this.paymentsService.initiatePayment(id);
  }

  @ApiOperation({ summary: 'Confirm payment status with provider verification' })
  @ApiResponse({ status: 200, description: 'Payment confirmed and order updated' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('payments:update')
  @Post(':id/confirm')
  async confirmPayment(
    @Param('id') id: string,
    @Body() body?: ConfirmPaymentDto,
  ) {
    return this.paymentsService.confirmPayment(id, body);
  }

  @ApiOperation({ summary: 'Cancel pending payment' })
  @ApiResponse({ status: 200, description: 'Payment cancelled successfully' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('payments:update')
  @Post(':id/cancel')
  async cancelPayment(@Param('id') id: string) {
    return this.paymentsService.cancelPayment(id);
  }

  @ApiOperation({ summary: 'Refund payment (full or partial)' })
  @ApiResponse({ status: 200, description: 'Payment refunded successfully' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('payments:refund')
  @Post(':id/refund')
  async refundPayment(
    @Param('id') id: string,
    @Body() body?: RefundPaymentDto,
  ) {
    return this.paymentsService.refundPayment(id, body);
  }

  @ApiOperation({ summary: 'Retry payment for recoverable failures' })
  @ApiResponse({ status: 200, description: 'Payment retry initiated' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('payments:update')
  @Post(':id/retry')
  async retryPayment(@Param('id') id: string) {
    return this.paymentsService.retryPayment(id);
  }

  @ApiOperation({ summary: 'Validate payment status' })
  @ApiResponse({ status: 200, description: 'Payment validation results' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('payments:read')
  @Get(':id/validate')
  async validatePayment(@Param('id') id: string) {
    return this.paymentsService.validatePayment(id);
  }

  @ApiOperation({ summary: 'Process incoming payment provider webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @Post('webhooks/:provider')
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() payload: WebhookPayloadDto | Record<string, unknown>,
    @Headers('x-webhook-signature') signature?: string,
    @Headers('x-webhook-timestamp') timestampHeader?: string,
    @Req() req?: Request & { rawBody?: Buffer | string },
  ) {
    const rawBody = req?.rawBody ? (typeof req.rawBody === 'string' ? req.rawBody : req.rawBody.toString('utf8')) : undefined;
    return this.paymentsService.processWebhook(provider, payload, signature, timestampHeader, rawBody);
  }
}
