import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';

export class RecordPaymentDto {
  @ApiProperty({ example: 'stripe', description: 'Payment gateway provider name' })
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @ApiProperty({ example: 'txn_123456789', description: 'Transaction ID from gateway' })
  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @ApiProperty({ example: 150.00, description: 'Payment amount' })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'SAR', default: 'SAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'PAID', default: 'PAID' })
  @IsOptional()
  @IsString()
  status?: string;
}
