import { IsUUID, IsNotEmpty, IsString, IsNumber, Min, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentIntentDto {
  @ApiProperty({ description: 'Order ID to initiate payment for' })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Payment provider name (e.g., qicard, zaincash, asiahawala, mock)' })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty({ description: 'Payment amount' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Payment metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
