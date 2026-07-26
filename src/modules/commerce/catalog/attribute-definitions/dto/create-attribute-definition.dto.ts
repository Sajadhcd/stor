import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUUID,
  IsObject,
  IsEnum,
  IsArray,
  ValidateIf,
  ValidateNested,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttributeType } from '@prisma/client';

/**
 * A single selectable option for "select" or "color"-type attributes.
 * value  — machine value stored on the variant (e.g. "red", "#FF0000")
 * labelTranslations — display label per locale (e.g. { ar: "أحمر", en: "Red" })
 */
export class AttributeOptionDto {
  @ApiProperty({ description: 'Machine value e.g. "red" or "#FF0000"', example: 'red' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  value: string;

  @ApiProperty({
    description: 'Localized display labels e.g. { ar: "أحمر", en: "Red" }',
    example: { ar: 'أحمر', en: 'Red' },
  })
  @IsNotEmpty()
  @IsObject()
  labelTranslations: Record<string, string>;
}

export class CreateAttributeDefinitionDto {
  @ApiPropertyOptional({
    description: 'Category ID this definition belongs to. Null = global (applies to all categories)',
    example: 'uuid-of-category',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({
    description: 'Machine name for the attribute key (unique per tenant+category). e.g. "color"',
    example: 'color',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Localized display label e.g. { ar: "اللون", en: "Color" }',
    example: { ar: 'اللون', en: 'Color' },
  })
  @IsNotEmpty()
  @IsObject()
  labelTranslations: Record<string, string>;

  @ApiProperty({
    description: 'Attribute input type',
    enum: AttributeType,
    enumName: 'AttributeType',
    example: 'select',
  })
  @IsEnum(AttributeType)
  type: AttributeType;

  @ApiPropertyOptional({
    description:
      'Allowed options array — required when type is "select" or "color". ' +
      'Each option must have a value and labelTranslations.',
    type: [AttributeOptionDto],
  })
  @ValidateIf((o) => o.type === 'select' || o.type === 'color')
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeOptionDto)
  options?: AttributeOptionDto[];

  @ApiPropertyOptional({
    description: 'Whether this attribute must be filled when creating a variant',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order among sibling definitions',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    description:
      'If true, this attribute differentiates variants (e.g. color, size). ' +
      'If false, it is a product-level informational spec (e.g. material).',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isVariantAxis?: boolean;
}
