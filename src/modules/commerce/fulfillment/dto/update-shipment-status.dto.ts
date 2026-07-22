import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ShipmentStatus } from '@prisma/client';

export class UpdateShipmentStatusDto {
  @ApiProperty({ enum: ShipmentStatus, example: ShipmentStatus.IN_TRANSIT, description: 'New shipment status' })
  @IsEnum(ShipmentStatus)
  @IsNotEmpty()
  status!: ShipmentStatus;
}
