import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdateWarehouseDto {
  @ApiPropertyOptional({ example: 'Baghdad Main Distribution Center', description: 'Warehouse facility name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the warehouse is currently active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
