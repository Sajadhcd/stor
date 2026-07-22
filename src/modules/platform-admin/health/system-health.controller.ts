import { Controller, Get, UseGuards } from '@nestjs/common';
import { SystemHealthService } from './system-health.service.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../security/decorators/permissions.decorator.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Platform Super-Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('platform:read')
@Controller('platform')
export class SystemHealthController {
  constructor(private readonly healthService: SystemHealthService) {}

  @ApiOperation({ summary: 'Get overall platform system health and component status' })
  @ApiResponse({ status: 200, description: 'System health retrieved' })
  @Get('system-health')
  async getHealth() {
    return this.healthService.getHealth();
  }
}
