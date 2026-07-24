import { IsNotEmpty, IsUrl, IsOptional, IsString, IsBoolean, IsInt, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddProductImageDto {
  @ApiProperty({ description: 'Image URL', example: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800' })
  @IsNotEmpty()
  @IsUrl({}, { message: 'url must be a valid URL' })
  url: string;

  @ApiPropertyOptional({ description: 'Alt text for accessibility' })
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional({ description: 'Set as primary image' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Variant ID if image is specific to a variant' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional({ description: 'Display sort order' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
