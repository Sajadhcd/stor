import { IsUUID, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MergeCartDto {
  @ApiProperty({ description: 'Guest session ID or Guest Cart ID to merge from' })
  @IsString()
  @IsNotEmpty()
  guestSessionIdOrCartId: string;

  @ApiProperty({ description: 'Store ID for isolation check' })
  @IsUUID()
  @IsNotEmpty()
  storeId: string;

  @ApiPropertyOptional({ description: 'Target customer ID to merge cart into' })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
