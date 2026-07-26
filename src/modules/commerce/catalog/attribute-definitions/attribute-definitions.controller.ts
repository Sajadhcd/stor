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
import { AttributeDefinitionsService } from './attribute-definitions.service.js';
import { CreateAttributeDefinitionDto } from './dto/create-attribute-definition.dto.js';
import { UpdateAttributeDefinitionDto } from './dto/update-attribute-definition.dto.js';
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

@ApiTags('Attribute Definitions')
@Controller('attribute-definitions')
export class AttributeDefinitionsController {
  constructor(
    private readonly attributeDefinitionsService: AttributeDefinitionsService,
  ) {}

  // ─── Public Read Endpoints ───────────────────────────────────────────────────

  @ApiOperation({
    summary: 'List all attribute definitions for the current tenant',
    description:
      'Returns attribute definitions sorted by position. ' +
      'Optionally filter by categoryId to get only definitions for a specific category. ' +
      'Pass categoryId=null to get global (category-independent) definitions.',
  })
  @ApiResponse({ status: 200, description: 'Attribute definitions list' })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'UUID of the category to filter by (omit for all)',
  })
  @Get()
  async findAll(@Query('categoryId') categoryId?: string) {
    return this.attributeDefinitionsService.findAll(categoryId);
  }

  @ApiOperation({ summary: 'Get a single attribute definition by ID' })
  @ApiResponse({ status: 200, description: 'Attribute definition found' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'id', description: 'UUID of the attribute definition' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.attributeDefinitionsService.findById(id);
  }

  // ─── Authenticated Mutations ─────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('catalog:manage')
  @ApiOperation({
    summary: 'Create a new attribute definition',
    description:
      'Creates a tenant-scoped attribute definition. ' +
      'If categoryId is omitted the definition applies globally (all categories). ' +
      '"select" and "color" types require a non-empty options array.',
  })
  @ApiResponse({ status: 201, description: 'Attribute definition created' })
  @ApiResponse({ status: 400, description: 'Validation error or invalid options' })
  @ApiResponse({ status: 409, description: 'Duplicate name in same scope' })
  @Post()
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateAttributeDefinitionDto,
  ) {
    return this.attributeDefinitionsService.create(dto, req.user.tenantId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('catalog:manage')
  @ApiOperation({ summary: 'Update an attribute definition' })
  @ApiResponse({ status: 200, description: 'Attribute definition updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Duplicate name in same scope' })
  @ApiParam({ name: 'id', description: 'UUID of the attribute definition' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAttributeDefinitionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.attributeDefinitionsService.update(id, dto, req.user.tenantId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('catalog:manage')
  @ApiOperation({
    summary: 'Delete an attribute definition',
    description:
      'Hard deletes the definition. ' +
      'Existing variant attribute JSON blobs are NOT modified (additive system).',
  })
  @ApiResponse({ status: 200, description: 'Attribute definition deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'id', description: 'UUID of the attribute definition' })
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.attributeDefinitionsService.remove(id, req.user.tenantId);
  }
}
