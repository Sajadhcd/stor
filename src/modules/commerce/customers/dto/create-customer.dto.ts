import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, IsOptional, IsObject } from 'class-validator';
import { Prisma } from '@prisma/client';

export class CreateCustomerDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the customer' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'Customer email address' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+9647701234567', description: 'Customer contact phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: { street: 'Al-Mansour', city: 'Baghdad', country: 'IQ' }, description: 'Structured address JSON' })
  @IsOptional()
  @IsObject()
  address?: Prisma.InputJsonValue;
}

