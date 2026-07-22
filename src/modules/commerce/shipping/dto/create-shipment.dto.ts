import { IsUUID, IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShipmentDto {
  @ApiProperty({ description: 'Order ID' })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Carrier name (e.g., dhl, fedex, aramex, mock)' })
  @IsString()
  @IsNotEmpty()
  carrier: string;

  @ApiPropertyOptional({ description: 'Fulfillment ID' })
  @IsOptional()
  @IsUUID()
  fulfillmentId?: string;

  @ApiPropertyOptional({ description: 'Service level (e.g., EXPRESS, STANDARD)' })
  @IsOptional()
  @IsString()
  serviceLevel?: string;

  @ApiPropertyOptional({ description: 'Custom tracking number override' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Shipment metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
