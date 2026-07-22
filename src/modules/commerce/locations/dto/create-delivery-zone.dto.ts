import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, IsInt } from 'class-validator';

export class CreateDeliveryZoneDto {
  @ApiProperty({ example: 'prov-123', description: 'ID of the province' })
  @IsString()
  @IsNotEmpty()
  provinceId!: string;

  @ApiProperty({ example: 'Al-Karkh Express', description: 'Delivery zone name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 5000, description: 'Delivery fee in IQD' })
  @IsNumber()
  @Min(0)
  deliveryFee!: number;

  @ApiPropertyOptional({ example: 2, description: 'Estimated delivery time in days' })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDays?: number;
}
