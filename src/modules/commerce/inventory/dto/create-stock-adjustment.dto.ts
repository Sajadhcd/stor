import { IsUUID, IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStockAdjustmentDto {
  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ description: 'Product Variant ID' })
  @IsUUID()
  variantId!: string;

  @ApiProperty({ description: 'Quantity change (+ or -)' })
  @IsNumber()
  quantityChange!: number;

  @ApiProperty({ description: 'Reason for adjustment' })
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ description: 'Reference ID (e.g. order ID or PO number)' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}
