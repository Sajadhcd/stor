import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'tenant-abc-123', description: 'ID of the tenant being subscribed' })
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @ApiProperty({ example: 'plan-xyz-789', description: 'ID of the subscription plan to assign' })
  @IsString()
  @IsNotEmpty()
  planId!: string;
}
