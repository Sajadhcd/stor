import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateShipmentDto {
  @ApiProperty({ example: 'order-123', description: 'Associated order ID' })
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({ example: 'DHL', description: 'Logistics carrier name' })
  @IsString()
  @IsNotEmpty()
  carrier!: string;

  @ApiProperty({ example: 'TRK99887766', description: 'Shipment tracking number' })
  @IsString()
  @IsNotEmpty()
  trackingNumber!: string;
}
