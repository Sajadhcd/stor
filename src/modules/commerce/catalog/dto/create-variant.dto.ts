import { IsNotEmpty, IsString, IsOptional, IsNumber, Min, IsBoolean, IsInt, IsObject } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Variant price override (sale price)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceOverride?: number;

  @ApiPropertyOptional({ description: 'Variant compare-at price (strike-through original price)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({ description: 'Variant weight in KG' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ description: 'Variant name display label' })
  @IsOptional()
  @IsString()
  variantName?: string;

  @ApiPropertyOptional({ description: 'Is the variant active and visible' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Sort position' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ description: 'Dimensions object { length, width, height, unit }' })
  @IsOptional()
  @IsObject()
  dimensions?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Variant attributes object e.g. { color: "Red", size: "XL" }' })
  @IsOptional()
  attributes?: Record<string, any>;
}
