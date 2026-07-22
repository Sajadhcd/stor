import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto.js';

export class OrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'store-uuid', description: 'Filter orders by store UUID' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ example: 'customer-uuid', description: 'Filter orders by customer UUID' })
  @IsOptional()
  @IsString()
  customerId?: string;
}
