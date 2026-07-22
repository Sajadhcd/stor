import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, IsObject, IsInt } from 'class-validator';
import { Prisma } from '@prisma/client';

export class CreatePlanDto {
  @ApiProperty({ example: 'Growth Plan', description: 'Plan display name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'GROWTH', description: 'Unique code identifier' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 499, description: 'Monthly subscription price' })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 'SAR', default: 'SAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'MONTHLY', default: 'MONTHLY' })
  @IsOptional()
  @IsString()
  billingCycle?: string;

  @ApiPropertyOptional({ example: 15, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @ApiPropertyOptional({ example: 5000, default: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxProducts?: number;

  @ApiPropertyOptional({ example: 50000, default: 10000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOrders?: number;

  @ApiPropertyOptional({ example: { analytics: true, prioritySupport: false }, description: 'Features JSON flag map' })
  @IsOptional()
  @IsObject()
  features?: Prisma.InputJsonValue;
}
