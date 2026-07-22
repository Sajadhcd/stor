import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto.js';

export class StockQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'var-123', description: 'Filter stock by product variant ID' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional({ example: 'wh-123', description: 'Filter stock by warehouse ID' })
  @IsOptional()
  @IsString()
  warehouseId?: string;
}
