import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'Baghdad Main Distribution Center', description: 'Warehouse facility name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Whether the warehouse is currently active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
