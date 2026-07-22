import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ShippingService } from './shipping.service.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { CreateShipmentDto } from './dto/create-shipment.dto.js';
import { CalculateShippingCostDto } from './dto/calculate-shipping-cost.dto.js';
import { UpdateTrackingDto } from './dto/update-tracking.dto.js';
import { InitiateReturnShipmentDto } from './dto/initiate-return-shipment.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../security/decorators/permissions.decorator.js';

@ApiTags('Shipping')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('shipments:update')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @ApiOperation({ summary: 'List shipments with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of shipments' })
  @Get('shipments')
  async listShipments(@Query() query: PaginationQueryDto) {
    return this.shippingService.listShipments(query);
  }

  @ApiOperation({ summary: 'Calculate estimated shipping cost' })
  @ApiResponse({ status: 200, description: 'Calculated shipping cost' })
  @Post('calculate-cost')
  async calculateCost(@Body() body: CalculateShippingCostDto) {
    const cost = this.shippingService.calculateShippingCost(body);
    return { shippingCost: cost };
  }

  @ApiOperation({ summary: 'Create a new carrier shipment' })
  @ApiResponse({ status: 201, description: 'Shipment created successfully' })
  @Post('shipments')
  async createShipment(@Body() body: CreateShipmentDto) {
    return this.shippingService.createShipment(body);
  }

  @ApiOperation({ summary: 'Get shipment details and tracking history' })
  @ApiResponse({ status: 200, description: 'Shipment details with tracking history' })
  @Get('shipments/:id')
  async getShipment(@Param('id') id: string) {
    return this.shippingService.getShipment(id);
  }

  @ApiOperation({ summary: 'Generate shipping label for a shipment' })
  @ApiResponse({ status: 200, description: 'Shipping label generated' })
  @Post('shipments/:id/label')
  async generateLabel(@Param('id') id: string) {
    return this.shippingService.generateShippingLabel(id);
  }

  @ApiOperation({ summary: 'Mark shipment as dispatched/shipped' })
  @ApiResponse({ status: 200, description: 'Shipment marked as shipped' })
  @Post('shipments/:id/ship')
  async markShipped(@Param('id') id: string) {
    return this.shippingService.markShipped(id);
  }

  @ApiOperation({ summary: 'Update carrier tracking status and location' })
  @ApiResponse({ status: 200, description: 'Tracking status updated' })
  @Patch('shipments/:id/tracking')
  async updateTracking(
    @Param('id') id: string,
    @Body() body: UpdateTrackingDto,
  ) {
    return this.shippingService.updateTrackingStatus(id, body);
  }

  @ApiOperation({ summary: 'Confirm final shipment delivery' })
  @ApiResponse({ status: 200, description: 'Shipment marked as delivered' })
  @Post('shipments/:id/deliver')
  async confirmDelivery(@Param('id') id: string) {
    return this.shippingService.confirmDelivery(id);
  }

  @ApiOperation({ summary: 'Initiate return shipment' })
  @ApiResponse({ status: 201, description: 'Return shipment initiated' })
  @Post('returns')
  async initiateReturn(@Body() body: InitiateReturnShipmentDto) {
    return this.shippingService.initiateReturnShipment(body);
  }

  @ApiOperation({ summary: 'Cancel shipment' })
  @ApiResponse({ status: 200, description: 'Shipment cancelled' })
  @Post('shipments/:id/cancel')
  async cancelShipment(@Param('id') id: string) {
    return this.shippingService.cancelShipment(id);
  }
}
