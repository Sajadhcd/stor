import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyCouponDto {
  @ApiProperty({ description: 'Coupon code to apply to checkout' })
  @IsString()
  @IsNotEmpty()
  couponCode: string;
}
