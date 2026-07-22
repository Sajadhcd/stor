import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { TenantStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto.js';

export class TenantQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TenantStatus, example: TenantStatus.ACTIVE, description: 'Filter tenants by status' })
  @IsOptional()
  @IsEnum(TenantStatus)
  tenantStatus?: TenantStatus;
}
