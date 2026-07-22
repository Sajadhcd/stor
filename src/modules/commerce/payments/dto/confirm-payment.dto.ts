import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmPaymentDto {
  @ApiPropertyOptional({ description: 'External transaction ID from provider' })
  @IsOptional()
  @IsString()
  externalTransactionId?: string;
}
