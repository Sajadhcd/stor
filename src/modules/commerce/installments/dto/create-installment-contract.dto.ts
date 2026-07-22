import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min, IsInt } from 'class-validator';

export class CreateInstallmentContractDto {
  @ApiProperty({ example: 'cust-123', description: 'Customer ID' })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty({ example: 'order-123', description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({ example: 1200000, description: 'Total installment amount in IQD' })
  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @ApiProperty({ example: 200000, description: 'Down payment paid upfront in IQD' })
  @IsNumber()
  @Min(0)
  downPayment!: number;

  @ApiProperty({ example: 12, description: 'Number of monthly installments' })
  @IsInt()
  @Min(1)
  months!: number;
}
