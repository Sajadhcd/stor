import { IsNumber, Min, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CalculateShippingCostDto {
  @ApiPropertyOptional({ description: 'Weight in kg' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional({ description: 'Distance in km' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional({ description: 'Order subtotal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  orderSubtotal?: number;

  @ApiPropertyOptional({ description: 'Carrier name' })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional({ description: 'Service level' })
  @IsOptional()
  @IsString()
  serviceLevel?: string;
}
