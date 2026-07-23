import { IsNotEmpty, IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVariantDto {
  @ApiProperty({ description: 'SKU code (must be unique per tenant)' })
  @IsNotEmpty()
  @IsString()
  sku: string;

  @ApiPropertyOptional({ description: 'Barcode value (must be unique per tenant)' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({ description: 'Variant sale price' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: 'Variant cost price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ description: 'Variant weight in KG' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ description: 'Variant attributes object e.g. { color: "Red", size: "XL" }' })
  @IsOptional()
  attributes?: Record<string, any>;
}
