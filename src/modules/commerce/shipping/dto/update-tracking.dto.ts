import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentStatus } from '@prisma/client';

export class UpdateTrackingDto {
  @ApiProperty({ enum: ShipmentStatus, description: 'Normalized shipment status' })
  @IsEnum(ShipmentStatus)
  @IsNotEmpty()
  status: ShipmentStatus;

  @ApiPropertyOptional({ description: 'Raw status from carrier' })
  @IsOptional()
  @IsString()
  carrierStatus?: string;

  @ApiPropertyOptional({ description: 'Current location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Tracking notes or remarks' })
  @IsOptional()
  @IsString()
  notes?: string;
}
