import { IsNotEmpty, IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBrandDto {
  @ApiProperty({ description: 'Brand name', example: 'Velo Activewear' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Brand URL slug', example: 'velo-activewear' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: 'Brand logo image URL', example: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400' })
  @IsOptional()
  @IsUrl({}, { message: 'logoUrl must be a valid URL' })
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Brand description', example: 'High-performance athletic apparel and footwear.' })
  @IsOptional()
  @IsString()
  description?: string;
}
