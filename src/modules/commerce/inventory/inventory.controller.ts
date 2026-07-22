import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service.js';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto.js';
import { StockQueryDto } from './dto/stock-query.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../security/decorators/permissions.decorator.js';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @ApiOperation({ summary: 'List all stock levels across warehouses for current tenant with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated stock levels retrieved successfully' })
  @RequirePermissions('inventory:read')
  @Get('stock-levels')
  async getStockLevels(@Query() query?: StockQueryDto) {
    if (query?.variantId && !query?.warehouseId && !query?.page && !query?.limit) {
      return this.inventoryService.getStock(query.variantId);
    }
    return this.inventoryService.getAllStockLevels(query);
  }

  @ApiOperation({ summary: 'Adjust physical stock level and record StockMovement ledger entry' })
  @ApiResponse({ status: 201, description: 'Stock adjusted and ledger recorded successfully' })
  @RequirePermissions('inventory:write')
  @Post('stock-adjustments')
  async adjustStock(@Body() dto: CreateStockAdjustmentDto) {
    return this.inventoryService.adjustStock(dto);
  }
}
