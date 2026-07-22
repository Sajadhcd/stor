import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto.js';

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'role-123', description: 'Filter users by role ID' })
  @IsOptional()
  @IsString()
  roleId?: string;
}
