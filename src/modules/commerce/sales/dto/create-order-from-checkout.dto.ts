import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderFromCheckoutDto {
  @ApiProperty({ description: 'Confirmed Checkout Session ID' })
  @IsUUID()
  @IsNotEmpty()
  checkoutId: string;

  @ApiPropertyOptional({ description: 'Internal customer note or instructions' })
  @IsOptional()
  @IsString()
  notes?: string;
}
