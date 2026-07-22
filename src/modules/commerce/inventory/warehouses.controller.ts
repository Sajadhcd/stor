import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service.js';
import { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';

@ApiTags('Warehouses')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly inventoryService: InventoryService) {}

  @ApiOperation({ summary: 'List all physical warehouses for current tenant with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of warehouses retrieved' })
  @Get()
  async findAll(@Query() query?: PaginationQueryDto) {
    return this.inventoryService.findAllWarehouses(query);
  }

  @ApiOperation({ summary: 'Get warehouse details by ID' })
  @ApiResponse({ status: 200, description: 'Warehouse retrieved' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.inventoryService.findWarehouseById(id);
  }

  @ApiOperation({ summary: 'Create a new physical warehouse' })
  @ApiResponse({ status: 201, description: 'Warehouse created successfully' })
  @Post()
  async create(@Body() body: CreateWarehouseDto) {
    return this.inventoryService.createWarehouse(body);
  }

  @ApiOperation({ summary: 'Update warehouse details' })
  @ApiResponse({ status: 200, description: 'Warehouse updated successfully' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateWarehouseDto) {
    return this.inventoryService.updateWarehouse(id, body);
  }

  @ApiOperation({ summary: 'Delete warehouse' })
  @ApiResponse({ status: 200, description: 'Warehouse deleted successfully' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.inventoryService.removeWarehouse(id);
  }
}
