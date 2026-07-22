import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformAnalyticsService } from './platform-analytics.service.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../security/decorators/permissions.decorator.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Platform Super-Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('platform:read')
@Controller('platform/analytics')
export class PlatformAnalyticsController {
  constructor(private readonly analyticsService: PlatformAnalyticsService) {}

  @ApiOperation({ summary: 'Get platform-wide analytics overview' })
  @ApiResponse({ status: 200, description: 'Overview retrieved' })
  @Get('overview')
  async getOverview() {
    return this.analyticsService.getOverview();
  }

  @ApiOperation({ summary: 'Get monthly platform revenue chart data' })
  @ApiResponse({ status: 200, description: 'Revenue chart data retrieved' })
  @Get('revenue')
  async getRevenueChart() {
    return this.analyticsService.getRevenueChart();
  }

  @ApiOperation({ summary: 'Get tenant usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage stats retrieved' })
  @Get('usage')
  async getUsageStats() {
    return this.analyticsService.getUsageStats();
  }
}
