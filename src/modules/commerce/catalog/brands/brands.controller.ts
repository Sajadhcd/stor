import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { BrandsService } from './brands.service.js';
import { CreateBrandDto } from './dto/create-brand.dto.js';
import { UpdateBrandDto } from './dto/update-brand.dto.js';
import { AuthGuard } from '../../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../../security/decorators/permissions.decorator.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

type AuthenticatedRequest = ExpressRequest & { user: { tenantId: string } };

@ApiTags('Brands Catalog')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @ApiOperation({ summary: 'List brands for current tenant' })
  @ApiResponse({ status: 200, description: 'Brands list retrieved successfully' })
  @Get()
  async findAll() {
    return this.brandsService.findAll();
  }

  @ApiOperation({ summary: 'Get single brand details' })
  @ApiResponse({ status: 200, description: 'Brand details retrieved' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.brandsService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Create a new brand' })
  @ApiResponse({ status: 201, description: 'Brand created successfully' })
  @RequirePermissions('products:create')
  @Post()
  async create(@Request() req: AuthenticatedRequest, @Body() dto: CreateBrandDto) {
    const tenantId = req.user.tenantId;
    return this.brandsService.create(dto, tenantId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update brand details' })
  @ApiResponse({ status: 200, description: 'Brand updated successfully' })
  @RequirePermissions('products:update')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user.tenantId;
    return this.brandsService.update(id, dto, tenantId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Delete brand' })
  @ApiResponse({ status: 200, description: 'Brand deleted successfully' })
  @RequirePermissions('products:delete')
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    return this.brandsService.delete(id, tenantId);
  }
}
