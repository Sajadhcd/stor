import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { LocationsService } from './locations.service.js';
import { CreateDeliveryZoneDto } from './dto/create-delivery-zone.dto.js';
import { UpdateDeliveryZoneDto } from './dto/update-delivery-zone.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Iraqi Provinces & Delivery Zones')
@Controller()
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @ApiOperation({ summary: 'List all 18 Iraqi provinces for current tenant' })
  @ApiResponse({ status: 200, description: 'Provinces retrieved' })
  @Get('provinces')
  async findAllProvinces() {
    return this.locationsService.findAllProvinces();
  }

  @ApiOperation({ summary: 'List all delivery zones with fees' })
  @ApiResponse({ status: 200, description: 'Delivery zones retrieved' })
  @Get('delivery-zones')
  async findAllDeliveryZones() {
    return this.locationsService.findAllDeliveryZones();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a delivery zone' })
  @ApiResponse({ status: 201, description: 'Delivery zone created' })
  @Post('delivery-zones')
  async createDeliveryZone(@Body() body: CreateDeliveryZoneDto) {
    return this.locationsService.createDeliveryZone(body);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update delivery zone configuration' })
  @ApiResponse({ status: 200, description: 'Delivery zone updated' })
  @Patch('delivery-zones/:id')
  async updateDeliveryZone(
    @Param('id') id: string,
    @Body() body: UpdateDeliveryZoneDto
  ) {
    return this.locationsService.updateDeliveryZone(id, body);
  }
}
