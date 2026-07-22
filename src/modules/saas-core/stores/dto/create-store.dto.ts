import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateStoreDto {
  @ApiProperty({ example: 'Flagship Store Baghdad', description: 'Name of the store' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'IQD', description: 'Default currency code (ISO 4217)', default: 'SAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'ar', description: 'Default language code (ISO 639-1)', default: 'ar' })
  @IsOptional()
  @IsString()
  languageDefault?: string;
}
