import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { OrderQueryDto } from './dto/order-query.dto.js';
import { CreateOrderFromCheckoutDto } from './dto/create-order-from-checkout.dto.js';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto.js';
import { UpdateFulfillmentStatusDto } from './dto/update-fulfillment-status.dto.js';
import { AddOrderNoteDto } from './dto/add-order-note.dto.js';
import { TrackOrderQueryDto } from './dto/track-order-query.dto.js';
import { OrderStatus } from '@prisma/client';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../security/decorators/permissions.decorator.js';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'List orders with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of orders' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('orders:read')
  @Get()
  async listOrders(@Query() query: OrderQueryDto) {
    return this.ordersService.listOrders(query);
  }

  @ApiOperation({ summary: 'Create order from confirmed checkout session' })
  @ApiResponse({ status: 201, description: 'Order created successfully from checkout' })
  @Post('checkout')
  async createOrderFromCheckout(@Body() body: CreateOrderFromCheckoutDto) {
    return this.ordersService.createOrderFromCheckout(body.checkoutId, body.notes);
  }

  @ApiOperation({ summary: 'Track a guest order using its number and customer phone' })
  @ApiResponse({ status: 200, description: 'Public order tracking details' })
  @Get('track/public')
  async trackOrder(@Query() query: TrackOrderQueryDto) {
    return this.ordersService.trackOrder(query.orderNumber, query.phone);
  }

  @ApiOperation({ summary: 'Get order details by ID' })
  @ApiResponse({ status: 200, description: 'Order details retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('orders:read')
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.ordersService.getOrder(id);
  }

  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('orders:update')
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') newStatus: OrderStatus,
    @Body('warehouseId') warehouseId?: string,
  ) {
    return this.ordersService.updateOrderStatus(id, newStatus, warehouseId);
  }

  @ApiOperation({ summary: 'Update order payment status' })
  @ApiResponse({ status: 200, description: 'Payment status updated' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('orders:update')
  @Patch(':id/payment-status')
  async updatePaymentStatus(
    @Param('id') id: string,
    @Body() body: UpdatePaymentStatusDto,
  ) {
    return this.ordersService.updatePaymentStatus(id, body.paymentStatus);
  }

  @ApiOperation({ summary: 'Update order fulfillment status' })
  @ApiResponse({ status: 200, description: 'Fulfillment status updated' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('orders:update')
  @Patch(':id/fulfillment-status')
  async updateFulfillmentStatus(
    @Param('id') id: string,
    @Body() body: UpdateFulfillmentStatusDto,
  ) {
    return this.ordersService.updateFulfillmentStatus(id, body.fulfillmentStatus);
  }

  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('orders:update')
  @Post(':id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.ordersService.cancelOrder(id, reason);
  }

  @ApiOperation({ summary: 'Add internal note to order' })
  @ApiResponse({ status: 200, description: 'Note added to order' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('orders:update')
  @Post(':id/notes')
  async addNote(
    @Param('id') id: string,
    @Body() body: AddOrderNoteDto,
  ) {
    return this.ordersService.addInternalNote(id, body.note);
  }

  @ApiOperation({ summary: 'Validate order state and inventory' })
  @ApiResponse({ status: 200, description: 'Validation results returned' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('orders:read')
  @Get(':id/validate')
  async validateOrder(@Param('id') id: string) {
    return this.ordersService.validateOrder(id);
  }
}
