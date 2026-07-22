import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FulfillmentStatus } from '@prisma/client';

export class UpdateFulfillmentStatusDto {
  @ApiProperty({ enum: FulfillmentStatus, description: 'New fulfillment status' })
  @IsEnum(FulfillmentStatus)
  @IsNotEmpty()
  fulfillmentStatus: FulfillmentStatus;
}
