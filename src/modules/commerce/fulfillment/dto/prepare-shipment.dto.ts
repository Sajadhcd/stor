import { IsUUID, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PrepareShipmentDto {
  @ApiProperty({ description: 'Order ID' })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Shipping carrier name' })
  @IsString()
  @IsNotEmpty()
  carrier: string;

  @ApiProperty({ description: 'Tracking number' })
  @IsString()
  @IsNotEmpty()
  trackingNumber: string;

  @ApiPropertyOptional({ description: 'Warehouse ID' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
