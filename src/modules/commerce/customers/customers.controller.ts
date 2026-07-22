import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { CustomerQueryDto } from './dto/customer-query.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../security/decorators/permissions.decorator.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Customers CRM')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'List all customers for current tenant with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'Paginated list of customers retrieved' })
  @RequirePermissions('customers:read')
  @Get()
  async findAll(@Query() query?: CustomerQueryDto) {
    return this.customersService.findAll(query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiResponse({ status: 200, description: 'Customer details' })
  @RequirePermissions('customers:read')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.customersService.findById(id);
  }

  @ApiOperation({ summary: 'Create customer' })
  @ApiResponse({ status: 201, description: 'Customer created' })
  @Post()
  async create(@Body() body: CreateCustomerDto) {
    return this.customersService.create(body);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update customer profile' })
  @ApiResponse({ status: 200, description: 'Customer updated' })
  @RequirePermissions('customers:write')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customersService.update(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Delete customer' })
  @ApiResponse({ status: 200, description: 'Customer deleted' })
  @RequirePermissions('customers:write')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
