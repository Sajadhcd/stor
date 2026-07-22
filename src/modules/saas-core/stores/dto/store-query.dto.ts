import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto.js';

export class StoreQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'SAR', description: 'Filter stores by currency code' })
  @IsOptional()
  @IsString()
  currency?: string;
}
