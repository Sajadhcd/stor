import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service.js';
import { AuthGuard } from '../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../security/decorators/permissions.decorator.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Analytics & Auditing')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @ApiOperation({ summary: 'Retrieve audit logs trail for the current tenant context with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated audit logs retrieved' })
  @RequirePermissions('analytics:read')
  @Get()
  async findAll(@Query() query?: PaginationQueryDto) {
    return this.auditLogService.findAll(query);
  }
}
