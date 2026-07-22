import { IsNotEmpty, IsString, IsNumber, Min, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateMatrixDto {
  @ApiProperty({ description: 'Base SKU prefix e.g. "VELO-TEE"' })
  @IsNotEmpty()
  @IsString()
  baseSku: string;

  @ApiProperty({ description: 'Default price for all generated variants' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({
    description: 'Option name and values mapping. E.g. { size: ["S", "M"], color: ["Red", "Blue"] }',
    example: { size: ['S', 'M', 'L'], color: ['Red', 'Blue'] },
  })
  @IsNotEmpty()
  @IsObject()
  options: Record<string, string[]>;
}
