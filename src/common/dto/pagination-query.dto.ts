import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number (1-indexed)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Number of records per page (max 100)', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'running', description: 'Search query keyword for filtering records' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'createdAt', description: 'Field name to sort by', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: SortOrder, example: SortOrder.DESC, description: 'Sort direction (asc or desc)', default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({ example: 'ACTIVE', description: 'Status filter keyword' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z', description: 'Filter records created on or after this ISO timestamp' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z', description: 'Filter records created on or before this ISO timestamp' })
  @IsOptional()
  @IsString()
  endDate?: string;

  get skip(): number {
    const p = this.page && this.page > 0 ? this.page : 1;
    const l = this.limit && this.limit > 0 ? Math.min(this.limit, 100) : 20;
    return (p - 1) * l;
  }

  get take(): number {
    return this.limit && this.limit > 0 ? Math.min(this.limit, 100) : 20;
  }
}
