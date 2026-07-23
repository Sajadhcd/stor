import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto.js';

export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'store-uuid', description: 'Filter products by store UUID' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ example: true, description: 'Filter products by published state' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1') return true;
    if (value === 'false' || value === false || value === '0') return false;
    return undefined;
  })
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ example: 'category-uuid', description: 'Filter products by category UUID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'brand-uuid', description: 'Filter products by brand UUID' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ example: 'velo-activewear', description: 'Filter products by brand slug' })
  @IsOptional()
  @IsString()
  brandSlug?: string;

  @ApiPropertyOptional({ example: 50, description: 'Minimum price filter' })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined))
  @IsNumber()
  minPrice?: number;

  @ApiPropertyOptional({ example: 500, description: 'Maximum price filter' })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined))
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional({ example: true, description: 'Filter products that have available stock' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1') return true;
    if (value === 'false' || value === false || value === '0') return false;
    return undefined;
  })
  @IsBoolean()
  inStockOnly?: boolean;

  @ApiPropertyOptional({ description: 'Filter by attribute key-value pairs (JSON or object)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    return value;
  })
  attributes?: Record<string, string>;
}

