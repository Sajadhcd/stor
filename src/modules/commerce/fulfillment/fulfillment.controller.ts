import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FulfillmentService } from './fulfillment.service.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { PrepareShipmentDto } from './dto/prepare-shipment.dto.js';
import { ProcessReturnDto } from './dto/process-return.dto.js';
import { InventoryActionDto } from './dto/inventory-action.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../security/decorators/permissions.decorator.js';

@ApiTags('Fulfillment')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('shipments:update')
@Controller('fulfillment')
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @ApiOperation({ summary: 'List shipments with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of shipments' })
  @Get('shipments')
  async listShipments(@Query() query: PaginationQueryDto) {
    return this.fulfillmentService.findAll(query);
  }

  @ApiOperation({ summary: 'Prepare a new shipment for packing' })
  @ApiResponse({ status: 201, description: 'Shipment prepared' })
  @Post('shipments/prepare')
  async prepareShipment(@Body() body: PrepareShipmentDto) {
    return this.fulfillmentService.prepareShipment(body.orderId, body.carrier, body.trackingNumber, body.warehouseId);
  }

  @ApiOperation({ summary: 'Mark shipment as packed' })
  @ApiResponse({ status: 200, description: 'Shipment marked as packed' })
  @Post('shipments/:id/pack')
  async markPacked(@Param('id') id: string) {
    return this.fulfillmentService.markPacked(id);
  }

  @ApiOperation({ summary: 'Mark shipment as shipped/dispatched' })
  @ApiResponse({ status: 200, description: 'Shipment marked as shipped' })
  @Post('shipments/:id/ship')
  async markShipped(@Param('id') id: string) {
    return this.fulfillmentService.markShipped(id);
  }

  @ApiOperation({ summary: 'Mark shipment as delivered' })
  @ApiResponse({ status: 200, description: 'Shipment marked as delivered' })
  @Post('shipments/:id/deliver')
  async markDelivered(@Param('id') id: string) {
    return this.fulfillmentService.markDelivered(id);
  }

  @ApiOperation({ summary: 'Cancel shipment and release reserved inventory' })
  @ApiResponse({ status: 200, description: 'Shipment cancelled and inventory released' })
  @Post('shipments/:id/cancel')
  async cancelFulfillment(@Param('id') id: string) {
    return this.fulfillmentService.cancelFulfillment(id);
  }

  @ApiOperation({ summary: 'Complete delivered order' })
  @ApiResponse({ status: 200, description: 'Order completed' })
  @Post('orders/:id/complete')
  async completeOrder(@Param('id') id: string) {
    return this.fulfillmentService.completeOrder(id);
  }

  @ApiOperation({ summary: 'Process customer order return' })
  @ApiResponse({ status: 200, description: 'Order return processed and restocked' })
  @Post('orders/returns')
  async processReturn(@Body() body: ProcessReturnDto) {
    return this.fulfillmentService.processReturn(body.orderId, body.reason, body.restock, body.warehouseId);
  }

  @ApiOperation({ summary: 'Reserve inventory for an order' })
  @ApiResponse({ status: 200, description: 'Inventory reserved' })
  @Post('inventory/reserve')
  async reserveInventory(@Body() body: InventoryActionDto) {
    await this.fulfillmentService.reserveInventory(body.orderId, body.warehouseId);
    return { success: true, message: 'Inventory reserved successfully' };
  }

  @ApiOperation({ summary: 'Commit inventory for a fulfilled order' })
  @ApiResponse({ status: 200, description: 'Inventory committed' })
  @Post('inventory/commit')
  async commitInventory(@Body() body: InventoryActionDto) {
    await this.fulfillmentService.commitInventory(body.orderId, body.warehouseId);
    return { success: true, message: 'Inventory committed successfully' };
  }

  @ApiOperation({ summary: 'Release reserved inventory' })
  @ApiResponse({ status: 200, description: 'Inventory released' })
  @Post('inventory/release')
  async releaseInventory(@Body() body: InventoryActionDto) {
    await this.fulfillmentService.releaseInventory(body.orderId, body.warehouseId);
    return { success: true, message: 'Inventory released successfully' };
  }

  @ApiOperation({ summary: 'Restock inventory for an order' })
  @ApiResponse({ status: 200, description: 'Inventory restocked' })
  @Post('inventory/restock')
  async restockInventory(@Body() body: InventoryActionDto) {
    await this.fulfillmentService.restockInventory(body.orderId, body.warehouseId);
    return { success: true, message: 'Inventory restocked successfully' };
  }
}
