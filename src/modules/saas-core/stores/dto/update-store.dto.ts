import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateStoreDto {
  @ApiPropertyOptional({ example: 'Flagship Store Baghdad', description: 'Name of the store' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'IQD', description: 'Default currency code (ISO 4217)' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'ar', description: 'Default language code (ISO 639-1)' })
  @IsOptional()
  @IsString()
  languageDefault?: string;
}
