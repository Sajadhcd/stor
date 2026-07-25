import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsObject,
  IsEnum,
  IsArray,
  ValidateIf,
  ValidateNested,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AttributeType } from '@prisma/client';
import { AttributeOptionDto } from './create-attribute-definition.dto.js';

export class UpdateAttributeDefinitionDto {
  @ApiPropertyOptional({
    description: 'Machine name for the attribute key',
    example: 'size',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Localized display label e.g. { ar: "الحجم", en: "Size" }',
    example: { ar: 'الحجم', en: 'Size' },
  })
  @IsOptional()
  @IsObject()
  labelTranslations?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Attribute input type',
    enum: AttributeType,
    enumName: 'AttributeType',
  })
  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;

  @ApiPropertyOptional({
    description:
      'Allowed options array — required when type is "select" or "color".',
    type: [AttributeOptionDto],
  })
  @ValidateIf((o) => o.type === 'select' || o.type === 'color')
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeOptionDto)
  options?: AttributeOptionDto[];

  @ApiPropertyOptional({ description: 'Whether this attribute is mandatory' })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ description: 'Sort order among sibling definitions' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    description: 'If true, differentiates variants; if false, product-level spec',
  })
  @IsOptional()
  @IsBoolean()
  isVariantAxis?: boolean;
}
