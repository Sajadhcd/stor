import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, Min, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class UpdateDeliveryZoneDto {
  @ApiPropertyOptional({ example: 'Al-Karkh Express', description: 'Delivery zone name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 5000, description: 'Delivery fee in IQD' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @ApiPropertyOptional({ example: 2, description: 'Estimated delivery time in days' })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDays?: number;

  @ApiPropertyOptional({ example: true, description: 'Whether this delivery zone is active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
