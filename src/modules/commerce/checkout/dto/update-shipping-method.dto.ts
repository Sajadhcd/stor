import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateShippingMethodDto {
  @ApiProperty({ description: 'Shipping method code (e.g. standard, express, free)' })
  @IsString()
  @IsNotEmpty()
  shippingMethodCode: string;
}
