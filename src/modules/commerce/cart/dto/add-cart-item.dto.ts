import { IsUUID, IsInt, Min, IsOptional, IsObject, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCartItemDto {
  @ApiProperty({ description: 'Product Variant ID' })
  @IsUUID()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({ description: 'Quantity of items to add', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ description: 'Custom item metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
