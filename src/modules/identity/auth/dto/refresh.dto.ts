import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'Secure JWT refresh token' })
  @IsNotEmpty()
  refreshToken!: string;
}
