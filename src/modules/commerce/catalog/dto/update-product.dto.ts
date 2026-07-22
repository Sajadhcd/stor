import { IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({ description: 'Localized title object e.g. { ar: "...", en: "..." }' })
  @IsOptional()
  @IsObject()
  titleTranslations?: Record<string, string>;

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
}
