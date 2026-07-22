import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto.js';

export class PaymentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'stripe', description: 'Filter payments by provider' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ example: 'order-123', description: 'Filter payments by order ID' })
  @IsOptional()
  @IsString()
  orderId?: string;
}
