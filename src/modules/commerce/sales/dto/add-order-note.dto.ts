import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddOrderNoteDto {
  @ApiProperty({ description: 'Internal note text to append' })
  @IsString()
  @IsNotEmpty()
  note: string;
}
