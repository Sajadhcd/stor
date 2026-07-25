import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUrl,
  IsBoolean,
  IsInt,
  IsUUID,
  IsObject,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Localized category name. e.g. { ar: "ملابس", en: "Apparel" }',
    example: { ar: 'ملابس', en: 'Apparel' },
  })
  @IsNotEmpty()
  @IsObject()
  nameTranslations: Record<string, string>;

  @ApiProperty({
    description: 'URL-friendly slug (unique per tenant)',
    example: 'apparel',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({
    description: 'Parent category ID for hierarchical nesting',
    example: 'uuid-of-parent',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Localized description. e.g. { ar: "وصف", en: "Description" }',
  })
  @IsOptional()
  @IsObject()
  descriptionTranslations?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Category banner / thumbnail image URL',
    example: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800',
  })
  @IsOptional()
  @IsUrl({}, { message: 'imageUrl must be a valid URL' })
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'SEO meta title (max 255 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string;

  @ApiPropertyOptional({ description: 'SEO meta description (max 500 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string;

  @ApiPropertyOptional({
    description: 'Whether the category is visible in the storefront',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Sort position for ordering sibling categories',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
