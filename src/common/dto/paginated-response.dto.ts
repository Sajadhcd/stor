import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Current page number (1-indexed)' })
  page!: number;

  @ApiProperty({ example: 20, description: 'Number of items per page' })
  limit!: number;

  @ApiProperty({ example: 100, description: 'Total number of items matching query' })
  total!: number;

  @ApiProperty({ example: 5, description: 'Total number of pages available' })
  totalPages!: number;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true, description: 'Array of data items for current page' })
  data!: T[];

  @ApiProperty({ type: () => PaginationMetaDto, description: 'Pagination metadata' })
  meta!: PaginationMetaDto;

  constructor(data: T[], total: number, page: number = 1, limit: number = 20) {
    const safePage = page > 0 ? page : 1;
    const safeLimit = limit > 0 ? Math.min(limit, 100) : 20;
    this.data = data;
    this.meta = {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }
}
