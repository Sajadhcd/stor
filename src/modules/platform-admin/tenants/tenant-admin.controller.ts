import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TenantAdminService } from './tenant-admin.service.js';
import { CreateTenantDto } from './dto/create-tenant.dto.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';
import { TenantQueryDto } from './dto/tenant-query.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../security/decorators/permissions.decorator.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TenantStatus } from '@prisma/client';

@ApiTags('Platform Super-Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('platform:manage')
@Controller('platform/tenants')
export class TenantAdminController {
  constructor(private readonly tenantAdminService: TenantAdminService) {}

  @ApiOperation({ summary: 'List all platform tenants with metric statistics and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated tenants list retrieved' })
  @Get()
  async findAll(@Query() query?: TenantQueryDto) {
    return this.tenantAdminService.findAll(query);
  }

  @ApiOperation({ summary: 'Get details of a specific tenant' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.tenantAdminService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new platform tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @Post()
  async create(@Body() body: CreateTenantDto) {
    return this.tenantAdminService.create(body);
  }

  @ApiOperation({ summary: 'Update tenant status or configuration' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateTenantDto) {
    return this.tenantAdminService.update(id, body);
  }

  @ApiOperation({ summary: 'Suspend/Soft delete a tenant' })
  @ApiResponse({ status: 200, description: 'Tenant suspended successfully' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.tenantAdminService.remove(id);
  }
}
