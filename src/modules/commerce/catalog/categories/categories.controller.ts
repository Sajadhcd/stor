import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { AttributeDefinitionsService } from '../attribute-definitions/attribute-definitions.service.js';
import { AuthGuard } from '../../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../../security/decorators/permissions.decorator.js';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

type AuthenticatedRequest = ExpressRequest & { user: { tenantId: string } };

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly attributeDefinitionsService: AttributeDefinitionsService,
  ) {}

  // ─── Public Endpoints ──────────────────────────────────────────────────────

  @ApiOperation({
    summary: 'List all categories as a nested tree',
    description:
      'Returns the full category hierarchy for the current tenant. ' +
      'Pass includeInactive=true (admin only) to include disabled categories.',
  })
  @ApiResponse({ status: 200, description: 'Category tree retrieved' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include inactive categories (admin use)',
  })
  @Get()
  async findAll(
    @Query('includeInactive') includeInactive?: string,
  ) {
    const flag = includeInactive === 'true';
    return this.categoriesService.findAll(flag);
  }

  @ApiOperation({ summary: 'Get category by slug (storefront SEO)' })
  @ApiResponse({ status: 200, description: 'Category found' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @Get('by-slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, description: 'Category found' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @ApiOperation({ summary: 'List products in a category (paginated)',
    description: 'Returns published products belonging to the given category ID.',
  })
  @ApiResponse({ status: 200, description: 'Paginated product list' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isPublished', required: false, type: Boolean })
  @Get(':id/products')
  async findProducts(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isPublished') isPublished?: string,
  ) {
    return this.categoriesService.findProducts(id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      isPublished: isPublished === undefined ? true : isPublished === 'true',
    });
  }

  @ApiOperation({
    summary: 'List attribute definitions for a category',
    description:
      'Returns all attribute definitions that apply to the given category, ' +
      'including global definitions (categoryId = null) merged with category-specific ones. ' +
      'Results are sorted by position ASC.',
  })
  @ApiResponse({ status: 200, description: 'Attribute definitions for category' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiParam({ name: 'id', description: 'UUID of the category' })
  @Get(':id/attribute-definitions')
  async findAttributeDefinitions(@Param('id') id: string) {
    return this.attributeDefinitionsService.findForCategory(id);
  }

  // ─── Authenticated / Admin Endpoints ───────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('categories:create')
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, description: 'Category created' })
  @ApiResponse({ status: 409, description: 'Slug already taken' })
  @Post()
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateCategoryDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.categoriesService.create(dto, tenantId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('categories:update')
  @ApiOperation({ summary: 'Update a category' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Slug already taken' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user.tenantId;
    return this.categoriesService.update(id, dto, tenantId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('categories:delete')
  @ApiOperation({
    summary: 'Delete a category',
    description:
      'Deletes the category. Child categories are promoted to root. ' +
      'Product associations (categories_products) are removed.',
  })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user.tenantId;
    return this.categoriesService.remove(id, tenantId);
  }
}
