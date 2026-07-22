import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service.js';
import { CreatePlanDto } from './dto/create-plan.dto.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../security/decorators/permissions.decorator.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Platform Super-Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('platform:manage')
@Controller('platform')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @ApiOperation({ summary: 'List all subscription plans with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated plans list retrieved' })
  @Get('plans')
  async findAllPlans(@Query() query?: PaginationQueryDto) {
    return this.subscriptionsService.findAllPlans(query);
  }

  @ApiOperation({ summary: 'Create a new subscription plan' })
  @ApiResponse({ status: 201, description: 'Plan created successfully' })
  @Post('plans')
  async createPlan(@Body() body: CreatePlanDto) {
    return this.subscriptionsService.createPlan(body);
  }

  @ApiOperation({ summary: 'List all active tenant subscriptions with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated subscriptions list retrieved' })
  @Get('subscriptions')
  async findAllSubscriptions(@Query() query?: PaginationQueryDto) {
    return this.subscriptionsService.findAllSubscriptions(query);
  }

  @ApiOperation({ summary: 'Assign a subscription plan to a tenant' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  @Post('subscriptions')
  async createSubscription(@Body() body: CreateSubscriptionDto) {
    return this.subscriptionsService.createSubscription(body.tenantId, body.planId);
  }

  @ApiOperation({ summary: 'List all platform billing invoices with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated invoices list retrieved' })
  @Get('invoices')
  async findAllInvoices(@Query() query?: PaginationQueryDto) {
    return this.subscriptionsService.findAllInvoices(query);
  }
}
