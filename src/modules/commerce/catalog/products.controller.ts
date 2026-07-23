import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { CreateVariantDto } from './dto/create-variant.dto.js';
import { UpdateVariantDto } from './dto/update-variant.dto.js';
import { GenerateMatrixDto } from './dto/generate-matrix.dto.js';
import { ProductQueryDto } from './dto/product-query.dto.js';
import { AddProductImageDto } from './dto/add-product-image.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../security/decorators/permissions.decorator.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

type AuthenticatedRequest = ExpressRequest & { user: { tenantId: string } };


@ApiTags('Products Catalog')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: 'List products for current tenant with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'Paginated products retrieved' })
  @Get()
  async findAll(@Query() query?: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @ApiOperation({ summary: 'Get details of a single product' })
  @ApiResponse({ status: 200, description: 'Product details' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created' })
  @RequirePermissions('products:create')
  @Post()
  async create(@Request() req: AuthenticatedRequest, @Body() body: CreateProductDto) {
    const tenantId = req.user.tenantId;
    return this.productsService.create({
      ...body,
      tenantId,
    });
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update product details' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @RequirePermissions('products:update')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Soft delete a product' })
  @ApiResponse({ status: 200, description: 'Product soft deleted successfully' })
  @RequirePermissions('products:delete')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productsService.softDelete(id);
  }

  // Product Images endpoints

  @ApiOperation({ summary: 'List images for a product' })
  @ApiResponse({ status: 200, description: 'Product images list' })
  @Get(':id/images')
  async getProductImages(@Param('id') productId: string) {
    return this.productsService.getProductImages(productId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Add an image to a product' })
  @ApiResponse({ status: 201, description: 'Image added successfully' })
  @RequirePermissions('products:update')
  @Post(':id/images')
  async addProductImage(
    @Param('id') productId: string,
    @Body() dto: AddProductImageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user.tenantId;
    return this.productsService.addProductImage(productId, dto, tenantId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Delete a product image' })
  @ApiResponse({ status: 200, description: 'Image deleted successfully' })
  @RequirePermissions('products:update')
  @Delete(':id/images/:imageId')
  async removeProductImage(
    @Param('id') productId: string,
    @Param('imageId') imageId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user.tenantId;
    return this.productsService.deleteProductImage(productId, imageId, tenantId);
  }

  // Variant management endpoints

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Add a new product variant' })
  @ApiResponse({ status: 201, description: 'Product variant created' })
  @RequirePermissions('products:create')
  @Post(':id/variants')
  async createVariant(
    @Param('id') productId: string,
    @Body() dto: CreateVariantDto,
    @Request() req: AuthenticatedRequest
  ) {
    const tenantId = req.user.tenantId;
    return this.productsService.createVariant(productId, {
      ...dto,
      tenantId,
    });
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update variant details' })
  @ApiResponse({ status: 200, description: 'Variant updated successfully' })
  @RequirePermissions('products:update')
  @Patch(':id/variants/:variantId')
  async updateVariant(
    @Param('id') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
    @Request() req: AuthenticatedRequest
  ) {
    const tenantId = req.user.tenantId;
    return this.productsService.updateVariant(productId, variantId, {
      ...dto,
      tenantId,
    });
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Delete product variant' })
  @ApiResponse({ status: 200, description: 'Variant deleted successfully' })
  @RequirePermissions('products:delete')
  @Delete(':id/variants/:variantId')
  async removeVariant(
    @Param('id') productId: string,
    @Param('variantId') variantId: string,
    @Request() req: AuthenticatedRequest
  ) {
    const tenantId = req.user.tenantId;
    return this.productsService.deleteVariant(productId, variantId, tenantId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Generate a matrix of product variants based on options combination' })
  @ApiResponse({ status: 201, description: 'Variants generated' })
  @RequirePermissions('products:create')
  @Post(':id/variants/matrix')
  @HttpCode(HttpStatus.CREATED)
  async generateMatrix(
    @Param('id') productId: string,
    @Body() dto: GenerateMatrixDto,
    @Request() req: AuthenticatedRequest
  ) {
    const tenantId = req.user.tenantId;
    return this.productsService.generateVariantMatrix(productId, {
      ...dto,
      tenantId,
    });
  }
}
