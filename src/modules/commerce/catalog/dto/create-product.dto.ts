import { IsNotEmpty, IsUUID, IsOptional, IsBoolean, IsObject, IsArray } from 'class-validator';
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
