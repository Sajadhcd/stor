import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class WebhookPayloadDto {
  @ApiPropertyOptional({ example: 'evt_123', description: 'Event identifier' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ example: 'evt_123', description: 'Alternative event identifier field' })
  @IsOptional()
  @IsString()
  event_id?: string;

  @ApiPropertyOptional({ example: 'order-123', description: 'Associated order ID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ example: 'paid', description: 'Payment event status' })
  @IsOptional()
  @IsString()
  status?: string;

  [key: string]: unknown;
}
