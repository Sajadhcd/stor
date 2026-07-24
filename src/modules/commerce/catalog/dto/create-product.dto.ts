import { IsNotEmpty, IsUUID, IsOptional, IsBoolean, IsObject, IsArray, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiPropertyOptional({ description: 'Store ID for the product context' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiProperty({ description: 'Localized title object e.g. { ar: "...", en: "..." }' })
  @IsNotEmpty()
  @IsObject()
  titleTranslations: Record<string, string>;

  @ApiPropertyOptional({ description: 'Localized description object' })
  @IsOptional()
  @IsObject()
  descriptionTranslations?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Custom product attributes JSON' })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Brand ID for the product' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ description: 'URL slug for the product' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: 'SEO Meta Title' })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional({ description: 'SEO Meta Description' })
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({ description: 'Product Image URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({ description: 'Publication status' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'Associated category IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  categoryIds?: string[];
}
