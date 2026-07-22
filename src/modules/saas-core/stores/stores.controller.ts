import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StoresService } from './stores.service.js';
import { CreateStoreDto } from './dto/create-store.dto.js';
import { UpdateStoreDto } from './dto/update-store.dto.js';
import { StoreQueryDto } from './dto/store-query.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';

@ApiTags('Stores')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @ApiOperation({ summary: 'List all stores owned by current tenant with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'Paginated stores retrieved successfully' })
  @Get()
  async findAll(@Query() query?: StoreQueryDto) {
    return this.storesService.findAll(query);
  }

  @ApiOperation({ summary: 'Get store by ID' })
  @ApiResponse({ status: 200, description: 'Store retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.storesService.findById(id);
  }

  @ApiOperation({ summary: 'Create a new store for tenant' })
  @ApiResponse({ status: 201, description: 'Store successfully created' })
  @Post()
  async create(@Body() body: CreateStoreDto) {
    return this.storesService.createStore(body);
  }

  @ApiOperation({ summary: 'Update store configuration' })
  @ApiResponse({ status: 200, description: 'Store updated successfully' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateStoreDto) {
    return this.storesService.update(id, body);
  }

  @ApiOperation({ summary: 'Delete store' })
  @ApiResponse({ status: 200, description: 'Store deleted successfully' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.storesService.remove(id);
  }
}
