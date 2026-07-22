import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsNumber, Min, IsArray, ValidateNested, IsOptional, IsObject } from 'class-validator';
import { Prisma } from '@prisma/client';

export class CreateOrderItemDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', description: 'Variant UUID' })
  @IsString()
  @IsNotEmpty()
  variantId!: string;


  @ApiProperty({ example: 100, description: 'Unit price of the variant' })
  @IsNumber()
  @Min(0)
  priceUnit!: number;

  @ApiProperty({ example: 2, description: 'Quantity purchased' })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 0.05, description: 'Tax rate applied' })
  @IsNumber()
  @Min(0)
  taxRate!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'store-uuid', description: 'Store UUID' })
  @IsString()
  @IsNotEmpty()
  storeId!: string;

  @ApiProperty({ example: 'customer-uuid', description: 'Customer UUID' })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty({ example: 'ORD-2026-0001', description: 'Unique order number' })
  @IsString()
  @IsNotEmpty()
  orderNumber!: string;

  @ApiProperty({ example: 200, description: 'Subtotal amount before tax and shipping' })
  @IsNumber()
  @Min(0)
  subtotal!: number;

  @ApiProperty({ example: 10, description: 'Total tax amount' })
  @IsNumber()
  @Min(0)
  taxTotal!: number;

  @ApiProperty({ example: 15, description: 'Total shipping cost' })
  @IsNumber()
  @Min(0)
  shippingTotal!: number;

  @ApiProperty({ example: 225, description: 'Grand total including tax and shipping' })
  @IsNumber()
  @Min(0)
  grandTotal!: number;

  @ApiProperty({ example: { street: '123 Main St', city: 'Baghdad', country: 'IQ' }, description: 'Shipping address JSON object' })
  @IsObject()
  shippingAddress!: Prisma.InputJsonValue;

  @ApiProperty({ type: [CreateOrderItemDto], description: 'List of order items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @ApiPropertyOptional({ example: 'tenant-uuid', description: 'Optional explicit tenant ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
