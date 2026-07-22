import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({ description: 'Cart ID to create checkout from' })
  @IsUUID()
  @IsNotEmpty()
  cartId: string;

  @ApiPropertyOptional({ description: 'Customer ID for authenticated checkout' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Coupon code if pre-applied' })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
