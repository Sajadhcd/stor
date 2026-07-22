import { IsUUID, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessReturnDto {
  @ApiProperty({ description: 'Order ID' })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiPropertyOptional({ description: 'Return reason' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Restock inventory returned items', default: true })
  @IsOptional()
  @IsBoolean()
  restock?: boolean;

  @ApiPropertyOptional({ description: 'Warehouse ID to restock to' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
