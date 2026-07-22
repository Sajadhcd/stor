import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsObject } from 'class-validator';
import { Prisma } from '@prisma/client';

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'John Doe', description: 'Full name of the customer' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com', description: 'Customer email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+9647701234567', description: 'Customer contact phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: { street: 'Al-Mansour', city: 'Baghdad', country: 'IQ' }, description: 'Structured address JSON' })
  @IsOptional()
  @IsObject()
  address?: Prisma.InputJsonValue;
}

