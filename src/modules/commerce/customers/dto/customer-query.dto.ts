import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto.js';

export class CustomerQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'john@example.com', description: 'Filter customers by exact email' })
  @IsOptional()
  @IsString()
  email?: string;
}
