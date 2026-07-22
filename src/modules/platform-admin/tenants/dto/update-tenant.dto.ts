import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { TenantStatus, Prisma } from '@prisma/client';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Velo Activewear Global', description: 'Tenant company name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: TenantStatus, example: TenantStatus.ACTIVE, description: 'Tenant lifecycle status' })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiPropertyOptional({ example: { theme: 'dark' }, description: 'Tenant custom settings JSON' })
  @IsOptional()
  @IsObject()
  settings?: Prisma.InputJsonValue;
}

