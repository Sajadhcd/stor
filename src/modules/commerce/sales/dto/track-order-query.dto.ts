import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TrackOrderQueryDto {
  @ApiProperty({ description: 'Public order number shown after checkout' })
  @IsString()
  @IsNotEmpty()
  orderNumber!: string;

  @ApiProperty({ description: 'Customer phone number used during checkout' })
  @IsString()
  @MinLength(6)
  phone!: string;
}
